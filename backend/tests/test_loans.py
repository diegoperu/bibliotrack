import pytest
from tests.conftest import create_test_user, get_token, TestingSessionLocal
from models.user import UserRole
from services.auth_service import hash_password
from models.user import User


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def lu1_headers(client):
    create_test_user("loanuser1", "loanuser1@example.com")
    token = get_token(client, "loanuser1")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def lu2_headers(client):
    create_test_user("loanuser2", "loanuser2@example.com")
    token = get_token(client, "loanuser2")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def admin_headers(client):
    db = TestingSessionLocal()
    try:
        if not db.query(User).filter(User.username == "loanadmin").first():
            db.add(User(
                username="loanadmin",
                email="loanadmin@example.com",
                hashed_password=hash_password("securepass123"),
                role=UserRole.admin,
                is_active=True,
            ))
            db.commit()
    finally:
        db.close()
    token = get_token(client, "loanadmin")
    return {"Authorization": f"Bearer {token}"}


def _create_book(client, headers, title="Test Book", author="Test Author"):
    resp = client.post("/books/", json={"title": title, "author": author}, headers=headers)
    assert resp.status_code == 201
    return resp.json()["id"]


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_create_loan_success(client, lu1_headers):
    book_id = _create_book(client, lu1_headers, "Loan Book 1")
    resp = client.post("/loans", json={
        "book_id": book_id,
        "borrower_name": "Mario Rossi",
        "notes": "Prima settimana di maggio",
    }, headers=lu1_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["book_id"] == book_id
    assert data["borrower_display_name"] == "Mario Rossi"
    assert data["is_active"] is True
    assert data["returned_at"] is None
    assert data["notes"] == "Prima settimana di maggio"


def test_create_loan_book_not_found(client, lu1_headers):
    resp = client.post("/loans", json={"book_id": 999999, "borrower_name": "Mario"}, headers=lu1_headers)
    assert resp.status_code == 404


def test_create_loan_already_on_loan(client, lu1_headers):
    book_id = _create_book(client, lu1_headers, "Loan Book Already")
    # First loan
    r1 = client.post("/loans", json={"book_id": book_id, "borrower_name": "Laura"}, headers=lu1_headers)
    assert r1.status_code == 201
    # Second loan attempt
    r2 = client.post("/loans", json={"book_id": book_id, "borrower_name": "Marco"}, headers=lu1_headers)
    assert r2.status_code == 409
    assert "Laura" in r2.json()["detail"]


def test_create_loan_new_borrower_created(client, lu1_headers):
    book_id = _create_book(client, lu1_headers, "Borrower Create Book")
    resp = client.post("/loans", json={"book_id": book_id, "borrower_name": "Nuova Persona"}, headers=lu1_headers)
    assert resp.status_code == 201
    assert resp.json()["borrower_display_name"] == "Nuova Persona"

    # Verify borrower appears in suggestions
    sugg = client.get("/loans/borrowers?q=nuova", headers=lu1_headers)
    assert sugg.status_code == 200
    names = [b["display_name"] for b in sugg.json()]
    assert "Nuova Persona" in names


def test_create_loan_existing_borrower_found_case_insensitive(client, lu1_headers):
    book1 = _create_book(client, lu1_headers, "Case Book 1")
    book2 = _create_book(client, lu1_headers, "Case Book 2")

    r1 = client.post("/loans", json={"book_id": book1, "borrower_name": "Anna Verdi"}, headers=lu1_headers)
    assert r1.status_code == 201
    borrower_id_first = r1.json()["borrower_id"]

    # Return book1
    client.put(f"/loans/{r1.json()['id']}/return", headers=lu1_headers)

    # Use different casing
    r2 = client.post("/loans", json={"book_id": book2, "borrower_name": "anna verdi"}, headers=lu1_headers)
    assert r2.status_code == 201
    # Same borrower reused
    assert r2.json()["borrower_id"] == borrower_id_first


def test_return_loan_success(client, lu1_headers):
    book_id = _create_book(client, lu1_headers, "Return Book")
    loan = client.post("/loans", json={"book_id": book_id, "borrower_name": "Tizio"}, headers=lu1_headers).json()
    resp = client.put(f"/loans/{loan['id']}/return", headers=lu1_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_active"] is False
    assert data["returned_at"] is not None
    assert data["duration_days"] is not None


def test_return_loan_with_notes(client, lu1_headers):
    book_id = _create_book(client, lu1_headers, "Return Notes Book")
    loan = client.post("/loans", json={
        "book_id": book_id, "borrower_name": "Caio", "notes": "Nota originale"
    }, headers=lu1_headers).json()
    resp = client.put(f"/loans/{loan['id']}/return", json={"notes": "Restituito in ritardo"}, headers=lu1_headers)
    assert resp.status_code == 200
    assert "Nota originale" in resp.json()["notes"]
    assert "Restituito in ritardo" in resp.json()["notes"]


def test_return_loan_already_returned(client, lu1_headers):
    book_id = _create_book(client, lu1_headers, "Already Returned Book")
    loan = client.post("/loans", json={"book_id": book_id, "borrower_name": "Sempronio"}, headers=lu1_headers).json()
    client.put(f"/loans/{loan['id']}/return", headers=lu1_headers)
    resp = client.put(f"/loans/{loan['id']}/return", headers=lu1_headers)
    assert resp.status_code == 409


def test_return_loan_not_found(client, lu1_headers):
    resp = client.put("/loans/999999/return", headers=lu1_headers)
    assert resp.status_code == 404


def test_list_loans_active_only(client, lu1_headers):
    book1 = _create_book(client, lu1_headers, "Active Only 1")
    book2 = _create_book(client, lu1_headers, "Active Only 2")
    l1 = client.post("/loans", json={"book_id": book1, "borrower_name": "Foo"}, headers=lu1_headers).json()
    l2 = client.post("/loans", json={"book_id": book2, "borrower_name": "Bar"}, headers=lu1_headers).json()
    # Return l2
    client.put(f"/loans/{l2['id']}/return", headers=lu1_headers)

    resp = client.get("/loans?active_only=true", headers=lu1_headers)
    assert resp.status_code == 200
    ids = [l["id"] for l in resp.json()]
    assert l1["id"] in ids
    assert l2["id"] not in ids


def test_list_loans_by_borrower(client, lu1_headers):
    book_id = _create_book(client, lu1_headers, "By Borrower Book")
    loan = client.post("/loans", json={"book_id": book_id, "borrower_name": "FilterPerson"}, headers=lu1_headers).json()
    borrower_id = loan["borrower_id"]

    resp = client.get(f"/loans?borrower_id={borrower_id}", headers=lu1_headers)
    assert resp.status_code == 200
    assert all(l["borrower_id"] == borrower_id for l in resp.json())


def test_borrower_suggestions_search(client, lu1_headers):
    # Create two books and loan them to two people
    b1 = _create_book(client, lu1_headers, "Sugg Book 1")
    b2 = _create_book(client, lu1_headers, "Sugg Book 2")
    l1 = client.post("/loans", json={"book_id": b1, "borrower_name": "Mario Bianchi"}, headers=lu1_headers)
    l2 = client.post("/loans", json={"book_id": b2, "borrower_name": "Marco Bianchi"}, headers=lu1_headers)
    # Return to allow re-use
    if l1.status_code == 201:
        client.put(f"/loans/{l1.json()['id']}/return", headers=lu1_headers)
    if l2.status_code == 201:
        client.put(f"/loans/{l2.json()['id']}/return", headers=lu1_headers)

    resp = client.get("/loans/borrowers?q=bianchi", headers=lu1_headers)
    assert resp.status_code == 200
    names = [b["display_name"] for b in resp.json()]
    assert "Mario Bianchi" in names
    assert "Marco Bianchi" in names


def test_borrower_detail_loan_count(client, lu1_headers):
    b1 = _create_book(client, lu1_headers, "BDetail Book 1")
    b2 = _create_book(client, lu1_headers, "BDetail Book 2")
    l1 = client.post("/loans", json={"book_id": b1, "borrower_name": "CountPerson"}, headers=lu1_headers).json()
    borrower_id = l1["borrower_id"]
    # Return l1 then loan b2
    client.put(f"/loans/{l1['id']}/return", headers=lu1_headers)
    client.post("/loans", json={"book_id": b2, "borrower_name": "CountPerson"}, headers=lu1_headers)

    resp = client.get(f"/loans/borrowers/{borrower_id}", headers=lu1_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_loans"] == 2
    assert data["active_loans"] == 1
    assert len(data["loans"]) == 2


def test_user_cannot_see_other_user_loans(client, lu1_headers, lu2_headers):
    book_id = _create_book(client, lu1_headers, "Isolation Loan Book")
    loan = client.post("/loans", json={"book_id": book_id, "borrower_name": "IsolPerson"}, headers=lu1_headers).json()
    loan_id = loan["id"]

    # lu2 cannot see lu1's loans in detail
    resp = client.get("/loans", headers=lu2_headers)
    assert resp.status_code == 200
    ids = [l["id"] for l in resp.json()]
    assert loan_id not in ids

    # lu2 cannot return lu1's loan
    resp2 = client.put(f"/loans/{loan_id}/return", headers=lu2_headers)
    assert resp2.status_code == 403


def test_admin_can_see_all_loans(client, lu1_headers, admin_headers):
    book_id = _create_book(client, lu1_headers, "Admin Visible Book")
    loan = client.post("/loans", json={"book_id": book_id, "borrower_name": "AdminSee"}, headers=lu1_headers).json()
    loan_id = loan["id"]

    resp = client.get("/loans", headers=admin_headers)
    assert resp.status_code == 200
    ids = [l["id"] for l in resp.json()]
    assert loan_id in ids


def test_book_detail_includes_active_loan(client, lu1_headers):
    book_id = _create_book(client, lu1_headers, "Detail Loan Book")
    client.post("/loans", json={"book_id": book_id, "borrower_name": "DetailPerson"}, headers=lu1_headers)

    resp = client.get(f"/books/{book_id}", headers=lu1_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["active_loan"] is not None
    assert data["active_loan"]["borrower_display_name"] == "DetailPerson"
    assert data["active_loan"]["is_active"] is True


def test_book_detail_no_active_loan_when_returned(client, lu1_headers):
    book_id = _create_book(client, lu1_headers, "Returned Loan Book")
    loan = client.post("/loans", json={"book_id": book_id, "borrower_name": "ReturnedPerson"}, headers=lu1_headers).json()
    client.put(f"/loans/{loan['id']}/return", headers=lu1_headers)

    resp = client.get(f"/books/{book_id}", headers=lu1_headers)
    assert resp.status_code == 200
    assert resp.json()["active_loan"] is None


def test_book_loans_history(client, lu1_headers):
    book_id = _create_book(client, lu1_headers, "History Book")
    l1 = client.post("/loans", json={"book_id": book_id, "borrower_name": "HistPerson"}, headers=lu1_headers).json()
    client.put(f"/loans/{l1['id']}/return", headers=lu1_headers)
    client.post("/loans", json={"book_id": book_id, "borrower_name": "HistPerson"}, headers=lu1_headers)

    resp = client.get(f"/books/{book_id}/loans", headers=lu1_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 2

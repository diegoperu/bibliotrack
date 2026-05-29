import pytest
from tests.conftest import create_test_user, get_token


@pytest.fixture
def auth_headers(client):
    create_test_user("bookuser", "bookuser@example.com")
    token = get_token(client, "bookuser")
    return {"Authorization": f"Bearer {token}"}


def test_create_book(client, auth_headers):
    resp = client.post("/books/", json={
        "title": "Il Nome della Rosa",
        "author": "Eco, Umberto",
        "isbn": "9788845268038",
        "genre": "Romanzo storico",
    }, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Il Nome della Rosa"
    assert data["status"] == "to_read"
    assert data["owner_id"] is not None


def test_list_books(client, auth_headers):
    resp = client.get("/books/", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_list_books_unauthorized(client):
    resp = client.get("/books/")
    assert resp.status_code == 401


def test_get_book(client, auth_headers):
    book_id = client.post("/books/", json={"title": "Dune", "author": "Herbert, Frank"}, headers=auth_headers).json()["id"]
    resp = client.get(f"/books/{book_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["title"] == "Dune"


def test_get_nonexistent_book(client, auth_headers):
    resp = client.get("/books/999999", headers=auth_headers)
    assert resp.status_code == 404


def test_update_book(client, auth_headers):
    book_id = client.post("/books/", json={"title": "1984", "author": "Orwell, George"}, headers=auth_headers).json()["id"]
    resp = client.patch(f"/books/{book_id}", json={"status": "read", "rating": 5}, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "read"
    assert data["rating"] == 5


def test_delete_book(client, auth_headers):
    book_id = client.post("/books/", json={"title": "ToDelete", "author": "Author"}, headers=auth_headers).json()["id"]
    assert client.delete(f"/books/{book_id}", headers=auth_headers).status_code == 204
    assert client.get(f"/books/{book_id}", headers=auth_headers).status_code == 404


def test_cross_user_isolation(client):
    create_test_user("isoluser1", "isol1@example.com", "securepass123")
    create_test_user("isoluser2", "isol2@example.com", "securepass123")

    t1 = get_token(client, "isoluser1")
    h1 = {"Authorization": f"Bearer {t1}"}
    book_id = client.post("/books/", json={"title": "Private Book", "author": "Author"}, headers=h1).json()["id"]

    t2 = get_token(client, "isoluser2")
    h2 = {"Authorization": f"Bearer {t2}"}

    assert client.get(f"/books/{book_id}", headers=h2).status_code == 403
    assert client.patch(f"/books/{book_id}", json={"title": "Hacked"}, headers=h2).status_code == 403
    assert client.delete(f"/books/{book_id}", headers=h2).status_code == 403


def test_filter_by_genre(client, auth_headers):
    client.post("/books/", json={"title": "SciFi Book", "author": "Author", "genre": "Fantascienza"}, headers=auth_headers)
    data = client.get("/books/?genre=Fantascienza", headers=auth_headers).json()
    assert isinstance(data, list)
    assert all(b["genre"] == "Fantascienza" for b in data)

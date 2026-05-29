from tests.conftest import create_test_user, get_token


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_register_endpoint_removed(client):
    """POST /auth/register must no longer exist (security: unauthenticated admin creation)."""
    resp = client.post("/auth/register", json={
        "username": "shouldfail",
        "email": "shouldfail@example.com",
        "password": "securepass123",
    })
    assert resp.status_code == 404


def test_login(client):
    create_test_user("loginuser", "login@example.com", "securepass123")
    resp = client.post("/auth/login", data={"username": "loginuser", "password": "securepass123"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client):
    create_test_user("wrongpass", "wrongpass@example.com", "correctpass1")
    resp = client.post("/auth/login", data={"username": "wrongpass", "password": "wrong"})
    assert resp.status_code == 401


def test_login_nonexistent_user(client):
    resp = client.post("/auth/login", data={"username": "nobody", "password": "nopass"})
    assert resp.status_code == 401


def test_get_me(client):
    create_test_user("meuser", "me@example.com")
    token = get_token(client, "meuser")
    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["username"] == "meuser"


def test_get_me_invalid_token(client):
    resp = client.get("/auth/me", headers={"Authorization": "Bearer invalidtoken"})
    assert resp.status_code == 401


def test_refresh_token_body(client):
    """Refresh token must be sent in request body, NOT as URL query parameter."""
    create_test_user("refreshuser", "refresh@example.com")
    login = client.post("/auth/login", data={"username": "refreshuser", "password": "securepass123"}).json()
    refresh = login["refresh_token"]

    # Correct: body
    resp = client.post("/auth/refresh", json={"token": refresh})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


def test_refresh_token_url_param_rejected(client):
    """Passing refresh token as URL query param should NOT work (endpoint no longer accepts it)."""
    create_test_user("refreshurl", "refreshurl@example.com")
    login = client.post("/auth/login", data={"username": "refreshurl", "password": "securepass123"}).json()
    refresh = login["refresh_token"]

    # Old (insecure) approach — query param — should return 422 (body required)
    resp = client.post(f"/auth/refresh?token={refresh}")
    assert resp.status_code == 422


def test_password_min_length_enforced(client):
    """Admin creating a user with a short password must be rejected."""
    from tests.conftest import create_test_user as ctu
    from sqlalchemy.exc import IntegrityError
    from pydantic import ValidationError
    from schemas.user import UserCreate

    try:
        UserCreate(username="x", email="x@x.com", password="short")
        assert False, "should have raised"
    except Exception as e:
        assert "8" in str(e)


def test_inactive_user_cannot_login(client):
    from tests.conftest import TestingSessionLocal
    from models.user import User as UserModel

    create_test_user("inactiveuser", "inactive@example.com")
    db = TestingSessionLocal()
    try:
        u = db.query(UserModel).filter(UserModel.username == "inactiveuser").first()
        u.is_active = False
        db.commit()
    finally:
        db.close()

    resp = client.post("/auth/login", data={"username": "inactiveuser", "password": "securepass123"})
    assert resp.status_code == 403

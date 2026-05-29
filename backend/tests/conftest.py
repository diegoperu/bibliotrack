import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from database import Base, get_db
from models.user import User, UserRole
from services.auth_service import hash_password
from main import app

_TEST_DB = os.path.join(os.path.dirname(__file__), "test.db")
TEST_DATABASE_URL = f"sqlite:///{_TEST_DB}"

engine_test = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})


@event.listens_for(engine_test, "connect")
def _wal(dbapi_conn, _):
    c = dbapi_conn.cursor()
    c.execute("PRAGMA journal_mode=WAL")
    c.close()


TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine_test)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.drop_all(bind=engine_test)
    Base.metadata.create_all(bind=engine_test)
    yield
    Base.metadata.drop_all(bind=engine_test)
    for f in [_TEST_DB, _TEST_DB + "-wal", _TEST_DB + "-shm"]:
        try:
            if os.path.exists(f):
                os.remove(f)
        except OSError:
            pass


def _override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_get_db


@pytest.fixture(scope="session")
def client():
    return TestClient(app)


# ── Test helpers ─────────────────────────────────────────────────────────────

def create_test_user(username: str, email: str, password: str = "securepass123",
                     role: str = "user") -> None:
    """Insert a user directly in the test DB (bypasses removed /auth/register)."""
    db = TestingSessionLocal()
    try:
        if not db.query(User).filter(User.username == username).first():
            db.add(User(
                username=username,
                email=email,
                hashed_password=hash_password(password),
                role=UserRole(role),
                is_active=True,
            ))
            db.commit()
    finally:
        db.close()


def get_token(client, username: str, password: str = "securepass123") -> str:
    """Return a valid access token for the given user."""
    resp = client.post("/auth/login", data={"username": username, "password": password})
    assert resp.status_code == 200, f"Login failed for {username}: {resp.text}"
    return resp.json()["access_token"]


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}

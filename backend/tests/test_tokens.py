"""Regressione sicurezza JWT (migrazione python-jose → PyJWT, DOMANDE.md D3)."""
import base64
import json
from datetime import datetime, timedelta, timezone

import jwt
import pytest

from config import settings
from services.auth_service import create_access_token, create_refresh_token, decode_token
from tests.conftest import create_test_user


def _b64(data: dict) -> str:
    return base64.urlsafe_b64encode(json.dumps(data).encode()).rstrip(b"=").decode()


def _exp(minutes: int = 5) -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=minutes)


def _me(client, token: str):
    return client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})


def test_roundtrip_access_and_refresh():
    assert decode_token(create_access_token({"sub": "u"}))["type"] == "access"
    assert decode_token(create_refresh_token({"sub": "u"}))["type"] == "refresh"


def test_alg_none_rejected(client):
    create_test_user("tok-none", "tok-none@example.com")
    forged = _b64({"alg": "none", "typ": "JWT"}) + "." + _b64(
        {"sub": "tok-none", "exp": int(_exp().timestamp()), "type": "access"}) + "."
    assert decode_token(forged) is None
    assert _me(client, forged).status_code == 401


def test_wrong_key_rejected(client):
    create_test_user("tok-key", "tok-key@example.com")
    forged = jwt.encode({"sub": "tok-key", "exp": _exp(), "type": "access"}, "x" * 64, algorithm="HS256")
    assert _me(client, forged).status_code == 401


# Token forgiato apposta con HS512 e chiave corta: l'avviso di PyJWT è atteso
@pytest.mark.filterwarnings("ignore::jwt.warnings.InsecureKeyLengthWarning")
def test_other_hmac_algorithm_rejected():
    token = jwt.encode({"sub": "u", "exp": _exp(), "type": "access"}, settings.SECRET_KEY, algorithm="HS512")
    assert decode_token(token) is None


def test_expired_rejected():
    token = create_access_token({"sub": "u"}, expires_delta=timedelta(seconds=-1))
    assert decode_token(token) is None


def test_missing_required_claims_rejected():
    for payload in ({"sub": "u", "type": "access"},             # niente exp: non scadrebbe mai
                    {"exp": _exp(), "type": "access"},          # niente sub
                    {"sub": "u", "exp": _exp()}):               # niente type
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        assert decode_token(token) is None, payload


def test_refresh_token_not_usable_as_access(client):
    create_test_user("tok-type", "tok-type@example.com")
    assert _me(client, create_refresh_token({"sub": "tok-type"})).status_code == 401


def test_malformed_tokens_rejected():
    for token in ("", "abc", "a.b", "a.b.c", "Bearer x"):
        assert decode_token(token) is None

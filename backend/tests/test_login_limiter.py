import pytest
from services.login_limiter import FailureLimiter, login_ip_limiter
from tests.conftest import auth_header, create_test_user, get_token


class _FakeClock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


# ── Unit: FailureLimiter ─────────────────────────────────────────────────────

def test_limiter_blocks_after_max_failures():
    clock = _FakeClock()
    lim = FailureLimiter(max_failures=3, window_seconds=60, block_seconds=120, clock=clock)
    for _ in range(2):
        lim.record_failure("k")
    assert lim.retry_after("k") == 0
    lim.record_failure("k")
    assert lim.retry_after("k") == 120
    clock.now += 119.5
    assert lim.retry_after("k") == 1
    clock.now += 1
    assert lim.retry_after("k") == 0


def test_limiter_window_expires_old_failures():
    clock = _FakeClock()
    lim = FailureLimiter(max_failures=3, window_seconds=60, block_seconds=120, clock=clock)
    lim.record_failure("k")
    lim.record_failure("k")
    clock.now += 61
    lim.record_failure("k")
    assert lim.retry_after("k") == 0


def test_limiter_reset_clears_key():
    lim = FailureLimiter(max_failures=2, window_seconds=60, block_seconds=60, clock=_FakeClock())
    lim.record_failure("k")
    lim.reset("k")
    lim.record_failure("k")
    assert lim.retry_after("k") == 0


def test_limiter_keys_are_independent():
    lim = FailureLimiter(max_failures=1, window_seconds=60, block_seconds=60, clock=_FakeClock())
    lim.record_failure("a")
    assert lim.retry_after("a") > 0
    assert lim.retry_after("b") == 0


def test_limiter_max_keys_bounds_memory():
    clock = _FakeClock()
    lim = FailureLimiter(max_failures=5, window_seconds=60, block_seconds=60, max_keys=3, clock=clock)
    for k in ("a", "b", "c", "d", "e"):
        lim.record_failure(k)
    assert len(lim._entries) == 3


def test_limiter_eviction_prefers_expired_keys():
    """Con memoria piena va scartata la chiave scaduta, non la meno recente:
    altrimenti un attaccante potrebbe "lavare" un blocco attivo inondando di chiavi."""
    clock = _FakeClock()
    lim = FailureLimiter(max_failures=2, window_seconds=60, block_seconds=600, max_keys=2, clock=clock)
    lim.record_failure("active")
    lim.record_failure("active")           # bloccato fino a +600s, è la chiave LRU
    clock.now += 1
    lim.record_failure("stale")            # 1 solo fallimento, scade dalla finestra a +61s
    clock.now += 100
    lim.record_failure("new")
    assert lim.retry_after("active") > 0
    assert "stale" not in lim._entries


def test_limiter_long_keys_are_truncated():
    lim = FailureLimiter(max_failures=1, window_seconds=60, block_seconds=60, clock=_FakeClock())
    lim.record_failure("x" * 10_000)
    assert all(len(k) <= 128 for k in lim._entries)
    assert lim.retry_after("x" * 10_000) > 0


def test_limiter_rejects_invalid_params():
    with pytest.raises(ValueError):
        FailureLimiter(max_failures=0, window_seconds=60, block_seconds=60)


# ── Integrazione: /auth/login ────────────────────────────────────────────────

def _login(client, username, password):
    return client.post("/auth/login", data={"username": username, "password": password})


def test_login_username_locked_after_5_failures(client):
    create_test_user("lockme", "lockme@example.com", "securepass123")
    for _ in range(5):
        assert _login(client, "lockme", "wrongpass").status_code == 401
    resp = _login(client, "lockme", "securepass123")   # password giusta, ma bloccato
    assert resp.status_code == 429
    assert int(resp.headers["Retry-After"]) > 0
    assert "access_token" not in resp.text


def test_login_nonexistent_user_locked_same_way(client):
    """Nessuna user enumeration: username inesistente → stesso 401 poi 429."""
    for _ in range(5):
        assert _login(client, "ghost-user", "whatever1").status_code == 401
    assert _login(client, "ghost-user", "whatever1").status_code == 429


def test_login_ip_locked_after_10_failures_across_usernames(client):
    create_test_user("ipvictim", "ipvictim@example.com", "securepass123")
    for i in range(10):
        assert _login(client, f"spray-{i}", "wrongpass").status_code == 401
    # Stesso IP, utente diverso con password corretta: bloccato
    assert _login(client, "ipvictim", "securepass123").status_code == 429


def test_login_success_resets_username_counter(client):
    create_test_user("resetme", "resetme@example.com", "securepass123")
    for _ in range(4):
        _login(client, "resetme", "wrongpass")
    assert _login(client, "resetme", "securepass123").status_code == 200
    for _ in range(4):
        assert _login(client, "resetme", "wrongpass").status_code == 401
    assert _login(client, "resetme", "securepass123").status_code == 200


def test_login_success_does_not_reset_ip_counter(client):
    create_test_user("ipreset", "ipreset@example.com", "securepass123")
    for i in range(9):
        _login(client, f"other-{i}", "wrongpass")
    assert _login(client, "ipreset", "securepass123").status_code == 200
    _login(client, "other-x", "wrongpass")             # 10° fallimento dallo stesso IP
    assert login_ip_limiter.retry_after("testclient") > 0


def test_login_overlong_password_is_401_not_500(client):
    create_test_user("longpw", "longpw@example.com", "securepass123")
    resp = _login(client, "longpw", "a" * 200)
    assert resp.status_code == 401


# ── Integrazione: change-password ────────────────────────────────────────────

def test_change_password_locked_after_5_wrong_current(client):
    create_test_user("chpw", "chpw@example.com", "securepass123")
    token = get_token(client, "chpw")
    me = client.get("/auth/me", headers=auth_header(token)).json()
    url = f"/users/{me['id']}/change-password"
    for _ in range(5):
        resp = client.post(url, json={"current_password": "wrongpass", "new_password": "newsecure123"},
                           headers=auth_header(token))
        assert resp.status_code == 400
    resp = client.post(url, json={"current_password": "securepass123", "new_password": "newsecure123"},
                       headers=auth_header(token))
    assert resp.status_code == 429


def test_password_over_72_bytes_rejected_on_create(client):
    create_test_user("admin72", "admin72@example.com", "securepass123", role="admin")
    token = get_token(client, "admin72")
    resp = client.post("/users/", json={"username": "u72", "email": "u72@example.com", "password": "é" * 40},
                       headers=auth_header(token))
    assert resp.status_code == 422

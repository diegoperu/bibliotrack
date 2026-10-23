"""Rate limiting dei tentativi di autenticazione falliti (brute force / credential stuffing).

Stato in memoria di processo: corretto perché uvicorn gira con --workers 1
(docker/supervisord.conf, deploy/bibliotrack.service). Con più worker ogni
processo avrebbe contatori separati. Lo stato si perde al riavvio: accettato.
"""
import math
import threading
import time
from collections import OrderedDict, deque
from typing import Callable, Optional

# Chiavi più lunghe vengono troncate: username e IP arrivano dal client e non
# devono poter gonfiare la memoria
_MAX_KEY_LEN = 128


class FailureLimiter:
    """Blocca una chiave per `block_seconds` dopo `max_failures` fallimenti
    registrati entro una finestra mobile di `window_seconds`."""

    def __init__(
        self,
        max_failures: int,
        window_seconds: int,
        block_seconds: int,
        max_keys: int = 10_000,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        if max_failures < 1 or window_seconds < 1 or block_seconds < 1 or max_keys < 1:
            raise ValueError("FailureLimiter parameters must be positive")
        self._max_failures = max_failures
        self._window = window_seconds
        self._block = block_seconds
        self._max_keys = max_keys
        self._clock = clock
        # key -> (timestamp fallimenti, blocked_until). OrderedDict = ordine LRU
        self._entries: "OrderedDict[str, tuple[deque, float]]" = OrderedDict()
        # Gli endpoint sync di FastAPI girano nel threadpool: accessi concorrenti
        self._lock = threading.Lock()

    @staticmethod
    def _norm(key: str) -> str:
        return key[:_MAX_KEY_LEN]

    def retry_after(self, key: str) -> int:
        """Secondi di attesa residui se la chiave è bloccata, altrimenti 0."""
        key = self._norm(key)
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return 0
            remaining = entry[1] - self._clock()
            return math.ceil(remaining) if remaining > 0 else 0

    def record_failure(self, key: str) -> None:
        key = self._norm(key)
        now = self._clock()
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                self._make_room(now)
                entry = (deque(), 0.0)
            failures, blocked_until = entry
            while failures and failures[0] <= now - self._window:
                failures.popleft()
            failures.append(now)
            if len(failures) >= self._max_failures:
                blocked_until = now + self._block
                failures.clear()
            self._entries[key] = (failures, blocked_until)
            self._entries.move_to_end(key)

    def reset(self, key: str) -> None:
        with self._lock:
            self._entries.pop(self._norm(key), None)

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()

    def _make_room(self, now: float) -> None:
        """Chiamato con il lock acquisito, prima di inserire una nuova chiave."""
        if len(self._entries) < self._max_keys:
            return
        expired = [
            k for k, (failures, blocked_until) in self._entries.items()
            if blocked_until <= now and (not failures or failures[-1] <= now - self._window)
        ]
        for k in expired:
            del self._entries[k]
        # Ancora pieno: scarta la chiave usata meno di recente
        while len(self._entries) >= self._max_keys:
            self._entries.popitem(last=False)


# Politica decisa 2026-10-23 (DOMANDE.md D8): per IP 10 fallimenti / 15 min,
# per username 5 fallimenti / 15 min, blocco 15 min. Gli username inesistenti
# vengono contati allo stesso modo: il 429 non rivela quali account esistono.
login_ip_limiter = FailureLimiter(max_failures=10, window_seconds=900, block_seconds=900)
login_user_limiter = FailureLimiter(max_failures=5, window_seconds=900, block_seconds=900)
# Verifica della password attuale in change-password: chiave = user id
change_password_limiter = FailureLimiter(max_failures=5, window_seconds=900, block_seconds=900)


def client_ip(host: Optional[str]) -> str:
    """IP client come risolto da uvicorn (--proxy-headers + FORWARDED_ALLOW_IPS)."""
    return host or "unknown"


def reset_all() -> None:
    """Solo per i test."""
    for limiter in (login_ip_limiter, login_user_limiter, change_password_limiter):
        limiter.clear()

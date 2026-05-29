import pytest
from unittest.mock import patch, MagicMock
import httpx

# --- helpers ---

OPEN_LIBRARY_DATA = {
    "ISBN:9788845268038": {
        "title": "Il nome della rosa",
        "authors": [{"name": "Umberto Eco"}],
        "publishers": [{"name": "Bompiani"}],
        "publish_date": "1980",
        "languages": [{"key": "/languages/ita"}],
        "number_of_pages": 502,
        "cover": {"large": "https://covers.openlibrary.org/b/id/12345-L.jpg"},
        "subjects": [{"name": "Romanzo storico"}],
    }
}

SEARCH_DATA = {
    "docs": [{
        "title": "Dune",
        "author_name": ["Frank Herbert"],
        "publisher": ["Ace Books"],
        "first_publish_year": 1965,
        "language": ["eng"],
        "number_of_pages_median": 412,
        "subject": ["Science fiction"],
    }]
}

GOOGLE_DATA = {
    "items": [{
        "volumeInfo": {
            "title": "Foundation",
            "authors": ["Isaac Asimov"],
            "publisher": "Gnome Press",
            "publishedDate": "1951",
            "language": "en",
            "pageCount": 255,
            "categories": ["Science Fiction"],
            "imageLinks": {"thumbnail": "https://books.google.com/cover.jpg"},
        }
    }]
}

SBN_DATA = {
    "ISBN-13":  "9788845292682",
    "Title":    "Il nome della rosa",
    "Authors":  ["Eco, Umberto"],
    "Publisher": "Bompiani",
    "Year":     "1980",
    "Language": "it",
}


class _MockResp:
    def __init__(self, json_data=None, status_code=200, content=b"x" * 2000):
        self._json = json_data or {}
        self.status_code = status_code
        self.content = content

    def json(self):
        return self._json

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("err", request=MagicMock(), response=self)


class _MockClient:
    def __init__(self, url_map):
        self._map = url_map

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        pass

    async def get(self, url, **kwargs):
        for fragment, resp in self._map.items():
            if fragment in url:
                return resp
        return _MockResp(status_code=404)


# --- SBN tests ---

async def test_lookup_sbn_primary():
    """SBN returns data → used as primary source for Italian ISBN."""
    from services.isbn_lookup import lookup_isbn

    with patch("services.isbn_lookup._SBN_AVAILABLE", True):
        with patch("services.isbn_lookup.isbnlib_meta", return_value=SBN_DATA):
            result = await lookup_isbn("9788845292682")

    assert result is not None
    assert result["title"] == "Il nome della rosa"
    assert result["author"] == "Eco, Umberto"
    assert result["language"] == "ita"
    assert result["year"] == 1980
    assert result["source"] == "sbn"
    assert result["isbn"] == "9788845292682"


async def test_lookup_sbn_fallback_to_openlibrary():
    """SBN raises → falls through to Open Library."""
    from services.isbn_lookup import lookup_isbn

    mock = _MockClient({"openlibrary.org/api/books": _MockResp(OPEN_LIBRARY_DATA)})
    with patch("services.isbn_lookup._SBN_AVAILABLE", True):
        with patch("services.isbn_lookup.isbnlib_meta", side_effect=Exception("SBN unavailable")):
            with patch("httpx.AsyncClient", return_value=mock):
                result = await lookup_isbn("9788845268038")

    assert result["source"] == "openlibrary"
    assert result["title"] == "Il nome della rosa"


async def test_lookup_sbn_empty_response_falls_through():
    """SBN returns empty dict → falls through to Open Library."""
    from services.isbn_lookup import lookup_isbn

    mock = _MockClient({"openlibrary.org/api/books": _MockResp(OPEN_LIBRARY_DATA)})
    with patch("services.isbn_lookup._SBN_AVAILABLE", True):
        with patch("services.isbn_lookup.isbnlib_meta", return_value={}):
            with patch("httpx.AsyncClient", return_value=mock):
                result = await lookup_isbn("9788845268038")

    assert result["source"] == "openlibrary"


async def test_lookup_sbn_skipped_for_non_italian():
    """SBN not tried for non-Italian ISBN."""
    from services.isbn_lookup import lookup_isbn

    mock = _MockClient({"openlibrary.org/api/books": _MockResp({}),"openlibrary.org/search.json": _MockResp(SEARCH_DATA)})
    sbn_mock = MagicMock()
    with patch("services.isbn_lookup._SBN_AVAILABLE", True):
        with patch("services.isbn_lookup.isbnlib_meta", sbn_mock):
            with patch("httpx.AsyncClient", return_value=mock):
                result = await lookup_isbn("9780441172719")  # non-Italian

    sbn_mock.assert_not_called()
    assert result["source"] == "openlibrary_search"


# --- existing lookup tests (Italian ISBNs need SBN mocked to fail) ---

async def test_lookup_openlibrary_primary():
    from services.isbn_lookup import lookup_isbn

    mock = _MockClient({"openlibrary.org/api/books": _MockResp(OPEN_LIBRARY_DATA)})
    with patch("services.isbn_lookup.isbnlib_meta", side_effect=Exception("SBN mock")):
        with patch("httpx.AsyncClient", return_value=mock):
            result = await lookup_isbn("9788845268038")

    assert result["title"] == "Il nome della rosa"
    assert result["author"] == "Umberto Eco"
    assert result["language"] == "ita"
    assert result["year"] == 1980
    assert result["pages"] == 502
    assert result["source"] == "openlibrary"
    assert result["isbn"] == "9788845268038"


async def test_lookup_openlibrary_search_fallback():
    from services.isbn_lookup import lookup_isbn

    mock = _MockClient({
        "openlibrary.org/api/books": _MockResp({}),
        "openlibrary.org/search.json": _MockResp(SEARCH_DATA),
    })
    with patch("httpx.AsyncClient", return_value=mock):
        result = await lookup_isbn("9780441172719")  # non-Italian, no SBN mock needed

    assert result["title"] == "Dune"
    assert result["author"] == "Frank Herbert"
    assert result["source"] == "openlibrary_search"
    assert result["year"] == 1965


async def test_lookup_google_books_fallback():
    from services.isbn_lookup import lookup_isbn

    mock = _MockClient({
        "openlibrary.org/api/books": _MockResp({}),
        "openlibrary.org/search.json": _MockResp({"docs": []}),
        "googleapis.com": _MockResp(GOOGLE_DATA),
    })
    with patch("httpx.AsyncClient", return_value=mock):
        result = await lookup_isbn("9780553293357")  # non-Italian

    assert result["title"] == "Foundation"
    assert result["author"] == "Isaac Asimov"
    assert result["source"] == "google_books"
    assert result["year"] == 1951


async def test_lookup_not_found():
    from services.isbn_lookup import lookup_isbn

    mock = _MockClient({
        "openlibrary.org/api/books": _MockResp({}),
        "openlibrary.org/search.json": _MockResp({"docs": []}),
        "googleapis.com": _MockResp({"items": []}),
    })
    with patch("httpx.AsyncClient", return_value=mock):
        result = await lookup_isbn("9999999999999")

    assert result is None


async def test_lookup_isbn_normalization():
    from services.isbn_lookup import lookup_isbn

    mock = _MockClient({"openlibrary.org/api/books": _MockResp(OPEN_LIBRARY_DATA)})
    with patch("services.isbn_lookup.isbnlib_meta", side_effect=Exception("SBN mock")):
        with patch("httpx.AsyncClient", return_value=mock):
            result = await lookup_isbn("978-88-45-268038")

    assert result["isbn"] == "9788845268038"


def test_normalize_isbn():
    from services.isbn_lookup import normalize_isbn
    assert normalize_isbn("978-88-452-6803-8") == "9788845268038"
    assert normalize_isbn("0 306 40615 2") == "0306406152"


def test_is_valid_isbn():
    from services.isbn_lookup import is_valid_isbn
    assert is_valid_isbn("9788845268038") is True
    assert is_valid_isbn("0306406152") is True
    assert is_valid_isbn("123") is False
    assert is_valid_isbn("abcdefghijklm") is False


def test_is_italian_isbn():
    from services.isbn_lookup import _is_italian_isbn
    assert _is_italian_isbn("9788845268038") is True   # 978-88
    assert _is_italian_isbn("9791234567890") is True   # 979-12
    assert _is_italian_isbn("8845268038") is True       # ISBN-10 88
    assert _is_italian_isbn("9780441172719") is False  # English
    assert _is_italian_isbn("9780553293357") is False  # English


# --- cover download unit tests ---

async def test_download_cover(tmp_path):
    from services.cover_download import download_cover

    big_content = b"\xff\xd8\xff" + b"x" * 2000

    mock = _MockClient({"covers.openlibrary.org": _MockResp(content=big_content, status_code=200)})
    with patch("httpx.AsyncClient", return_value=mock):
        path = await download_cover("9788845268038", tmp_path / "covers")

    assert path == "covers/9788845268038.jpg"
    assert (tmp_path / "covers" / "9788845268038.jpg").exists()


async def test_download_cover_too_small_uses_fallback(tmp_path):
    from services.cover_download import download_cover

    small = b"x" * 100
    big   = b"x" * 2000
    call_count = 0

    class SequentialMock:
        async def __aenter__(self): return self
        async def __aexit__(self, *_): pass
        async def get(self, url, **kwargs):
            nonlocal call_count
            call_count += 1
            if "covers.openlibrary.org" in url:
                return _MockResp(content=small, status_code=200)
            return _MockResp(content=big, status_code=200)

    with patch("httpx.AsyncClient", return_value=SequentialMock()):
        path = await download_cover("9788845268038", tmp_path / "covers", fallback_url="https://example.com/cover.jpg")

    assert path == "covers/9788845268038.jpg"


# --- endpoint integration tests ---

@pytest.fixture
def auth_headers(client):
    from tests.conftest import create_test_user, get_token
    create_test_user("isbnuser", "isbn@example.com")
    token = get_token(client, "isbnuser")
    return {"Authorization": f"Bearer {token}"}


def test_get_isbn_metadata_endpoint(client, auth_headers):
    mock = _MockClient({"openlibrary.org/api/books": _MockResp(OPEN_LIBRARY_DATA)})
    with patch("services.isbn_lookup.isbnlib_meta", side_effect=Exception("SBN mock")):
        with patch("httpx.AsyncClient", return_value=mock):
            resp = client.get("/isbn/9788845268038")
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Il nome della rosa"
    assert data["isbn"] == "9788845268038"


def test_get_isbn_invalid_format(client):
    resp = client.get("/isbn/123")
    assert resp.status_code == 400


def test_get_isbn_not_found(client):
    mock = _MockClient({
        "openlibrary.org/api/books": _MockResp({}),
        "openlibrary.org/search.json": _MockResp({"docs": []}),
        "googleapis.com": _MockResp({"items": []}),
    })
    with patch("httpx.AsyncClient", return_value=mock):
        resp = client.get("/isbn/9999999999999")
    assert resp.status_code == 404


def test_import_isbn_endpoint(client, auth_headers):
    ol_mock    = _MockClient({"openlibrary.org/api/books": _MockResp(OPEN_LIBRARY_DATA)})
    cover_mock = _MockClient({"covers.openlibrary.org": _MockResp(content=b"x" * 2000)})

    with patch("services.isbn_lookup.isbnlib_meta", side_effect=Exception("SBN mock")):
        with patch("httpx.AsyncClient", side_effect=[ol_mock, cover_mock]):
            resp = client.post("/isbn/9788845268038/import", headers=auth_headers)

    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Il nome della rosa"
    assert data["isbn"] == "9788845268038"
    assert data["owner_id"] is not None


def test_import_isbn_with_options(client, auth_headers):
    ol_mock    = _MockClient({"openlibrary.org/api/books": _MockResp(OPEN_LIBRARY_DATA)})
    cover_mock = _MockClient({"covers.openlibrary.org": _MockResp(content=b"x" * 2000)})

    with patch("services.isbn_lookup.isbnlib_meta", side_effect=Exception("SBN mock")):
        with patch("httpx.AsyncClient", side_effect=[ol_mock, cover_mock]):
            resp = client.post(
                "/isbn/9788845268038/import",
                json={"status": "read", "rating": 5, "notes": "Capolavoro"},
                headers=auth_headers,
            )

    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "read"
    assert data["rating"] == 5
    assert data["notes"] == "Capolavoro"


def test_import_isbn_requires_auth(client):
    resp = client.post("/isbn/9788845268038/import")
    assert resp.status_code == 401

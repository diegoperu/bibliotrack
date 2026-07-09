import io
import json
import zipfile

import pytest
from config import settings
from tests.conftest import create_test_user, get_token


@pytest.fixture
def auth_headers(client):
    create_test_user("exportuser", "exportuser@example.com")
    token = get_token(client, "exportuser")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def other_auth_headers(client):
    create_test_user("exportuser2", "exportuser2@example.com")
    token = get_token(client, "exportuser2")
    return {"Authorization": f"Bearer {token}"}


def _make_zip(bundle: dict, covers: dict[str, bytes] | None = None) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("export.json", json.dumps(bundle))
        for name, data in (covers or {}).items():
            zf.writestr(f"covers/{name}", data)
    return buf.getvalue()


def test_export_zip_structure(client, auth_headers):
    book_id = client.post(
        "/books/",
        json={"title": "Il Nome della Rosa", "author": "Eco, Umberto", "isbn": "9788845268038"},
        headers=auth_headers,
    ).json()["id"]

    # simulate a locally downloaded cover so the zip should bundle it
    settings.COVERS_DIR.mkdir(parents=True, exist_ok=True)
    cover_path = settings.COVERS_DIR / "9788845268038.jpg"
    cover_path.write_bytes(b"x" * 2000)
    client.patch(f"/books/{book_id}", json={"cover_path": "covers/9788845268038.jpg"}, headers=auth_headers)

    resp = client.get("/books/export", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/zip"

    with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
        names = zf.namelist()
        assert "export.json" in names
        assert "covers/9788845268038.jpg" in names
        bundle = json.loads(zf.read("export.json"))
        assert bundle["schema_version"] == 2
        assert bundle["source"] == "bibliotrack-web"
        titles = [b["title"] for b in bundle["books"]]
        assert "Il Nome della Rosa" in titles

    cover_path.unlink(missing_ok=True)


def test_export_unauthorized(client):
    resp = client.get("/books/export")
    assert resp.status_code == 401


def test_import_creates_book_and_loan(client, auth_headers):
    bundle = {
        "schema_version": 2,
        "exported_at": "2026-01-01T00:00:00Z",
        "source": "bibliotrack-web",
        "books": [
            {
                "isbn": "9780000000002",
                "title": "Imported Book",
                "author": "Some, Author",
                "status": "reading",
                "added_at": "2025-01-01T00:00:00Z",
                "loans": [
                    {
                        "borrower_name": "Mario Rossi",
                        "loaned_at": "2025-03-01T00:00:00Z",
                        "returned_at": "2025-04-15T00:00:00Z",
                    }
                ],
            }
        ],
    }
    zip_bytes = _make_zip(bundle)

    resp = client.post(
        "/books/import",
        files={"file": ("export.zip", zip_bytes, "application/zip")},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["imported"] == 1
    assert result["skipped"] == 0
    assert result["errors"] == []

    books = client.get("/books/", headers=auth_headers).json()
    imported = next(b for b in books if b["isbn"] == "9780000000002")
    assert imported["title"] == "Imported Book"
    assert imported["status"] == "reading"

    loans = client.get(f"/books/{imported['id']}/loans", headers=auth_headers).json()
    assert len(loans) == 1
    assert loans[0]["borrower_display_name"] == "Mario Rossi"
    assert loans[0]["is_active"] is False


def test_import_dedup_by_isbn(client, auth_headers):
    bundle = {
        "schema_version": 2,
        "exported_at": "2026-01-01T00:00:00Z",
        "source": "bibliotrack-web",
        "books": [
            {
                "isbn": "9780000000003",
                "title": "Dup Book",
                "author": "Some, Author",
                "status": "to_read",
                "added_at": "2025-01-01T00:00:00Z",
            }
        ],
    }
    zip_bytes = _make_zip(bundle)

    first = client.post(
        "/books/import", files={"file": ("export.zip", zip_bytes, "application/zip")}, headers=auth_headers
    ).json()
    assert first["imported"] == 1

    second = client.post(
        "/books/import", files={"file": ("export.zip", zip_bytes, "application/zip")}, headers=auth_headers
    ).json()
    assert second["imported"] == 0
    assert second["skipped"] == 1


def test_import_invalid_zip(client, auth_headers):
    resp = client.post(
        "/books/import",
        files={"file": ("bad.zip", b"not a zip file", "application/zip")},
        headers=auth_headers,
    )
    assert resp.status_code == 400


def test_import_rejects_path_traversal_isbn(client, auth_headers):
    bundle = {
        "schema_version": 2,
        "exported_at": "2026-01-01T00:00:00Z",
        "source": "bibliotrack-web",
        "books": [
            {
                "isbn": "../../../../tmp/evil",
                "title": "Malicious Book",
                "author": "Attacker",
                "status": "to_read",
                "added_at": "2025-01-01T00:00:00Z",
                "cover_url": None,
            }
        ],
    }
    zip_bytes = _make_zip(bundle, covers={"../../../../tmp/evil.jpg": b"x" * 10})

    resp = client.post(
        "/books/import", files={"file": ("export.zip", zip_bytes, "application/zip")}, headers=auth_headers
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["imported"] == 1

    books = client.get("/books/", headers=auth_headers).json()
    imported = next(b for b in books if b["title"] == "Malicious Book")
    # malformed isbn must never reach the filesystem — stored as null, no path traversal
    assert imported["isbn"] is None
    assert not (settings.COVERS_DIR / ".." / ".." / ".." / ".." / "tmp" / "evil.jpg").resolve().exists()


def test_import_rejects_oversized_file(client, auth_headers):
    huge = b"x" * (50 * 1024 * 1024 + 1)
    resp = client.post(
        "/books/import", files={"file": ("big.zip", huge, "application/zip")}, headers=auth_headers
    )
    assert resp.status_code == 413


def test_import_rejects_zip_bomb_json(client, auth_headers):
    # export.json che dichiara >20MB decompressi (comprime a pochi KB) → 400
    huge_json = b'{"schema_version": 2, "exported_at": "2026-01-01T00:00:00Z", "source": "bibliotrack-web", "books": [], "pad": "' + b"A" * (21 * 1024 * 1024) + b'"}'
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("export.json", huge_json)
    resp = client.post(
        "/books/import", files={"file": ("bomb.zip", buf.getvalue(), "application/zip")}, headers=auth_headers
    )
    assert resp.status_code == 400
    assert "troppo grande" in resp.json()["detail"]


def test_ssrf_guard_blocks_private_urls():
    from services.export_service import _is_safe_cover_url

    assert _is_safe_cover_url("http://127.0.0.1:8000/admin") is False
    assert _is_safe_cover_url("http://localhost/x.jpg") is False
    assert _is_safe_cover_url("http://192.168.1.1/router.jpg") is False
    assert _is_safe_cover_url("http://10.0.0.5/x.jpg") is False
    assert _is_safe_cover_url("http://169.254.169.254/latest/meta-data/") is False
    assert _is_safe_cover_url("file:///etc/passwd") is False
    assert _is_safe_cover_url("ftp://example.com/x.jpg") is False
    assert _is_safe_cover_url(None) is False
    assert _is_safe_cover_url("") is False


def test_import_unknown_status_falls_back_to_to_read(client, auth_headers):
    bundle = {
        "schema_version": 2,
        "exported_at": "2026-01-01T00:00:00Z",
        "source": "bibliotrack-web",
        "books": [
            {
                "isbn": "9780000000004",
                "title": "Weird Status Book",
                "author": "Some, Author",
                "status": "not-a-real-status",
                "added_at": "2025-01-01T00:00:00Z",
            }
        ],
    }
    zip_bytes = _make_zip(bundle)
    resp = client.post(
        "/books/import", files={"file": ("export.zip", zip_bytes, "application/zip")}, headers=auth_headers
    )
    assert resp.status_code == 200
    books = client.get("/books/", headers=auth_headers).json()
    imported = next(b for b in books if b["isbn"] == "9780000000004")
    assert imported["status"] == "to_read"

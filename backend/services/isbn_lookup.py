import re
import httpx
from typing import Optional

OPENLIBRARY_API = "https://openlibrary.org/api/books"
OPENLIBRARY_SEARCH = "https://openlibrary.org/search.json"
GOOGLE_BOOKS_API = "https://www.googleapis.com/books/v1/volumes"
TIMEOUT = 10.0


def normalize_isbn(isbn: str) -> str:
    return re.sub(r"[\s\-]", "", isbn).strip()


def is_valid_isbn(isbn: str) -> bool:
    return bool(re.match(r"^\d{10}$|^\d{13}$", isbn))


def _extract_year(date_str: str) -> Optional[int]:
    if not date_str:
        return None
    m = re.search(r"\b(\d{4})\b", date_str)
    return int(m.group(1)) if m else None


def _parse_openlibrary(data: dict) -> dict:
    authors = [a.get("name", "") for a in data.get("authors", [])]

    publishers = data.get("publishers", [])
    publisher = publishers[0].get("name") if publishers else None

    languages = data.get("languages", [])
    language = languages[0].get("key", "").split("/")[-1] if languages else None

    cover = data.get("cover", {})
    cover_url = cover.get("large") or cover.get("medium") or cover.get("small")

    subjects = data.get("subjects", [])
    if subjects:
        first = subjects[0]
        genre = first.get("name") if isinstance(first, dict) else first
    else:
        genre = None

    description = data.get("notes") or data.get("description") or None
    if isinstance(description, dict):
        description = description.get("value")

    return {
        "title": data.get("title", ""),
        "author": ", ".join(authors) if authors else "",
        "authors": authors,
        "publisher": publisher,
        "year": _extract_year(data.get("publish_date", "")),
        "language": language,
        "description": description,
        "pages": data.get("number_of_pages"),
        "cover_url": cover_url,
        "genre": genre,
    }


def _parse_openlibrary_search(doc: dict) -> dict:
    author_names = doc.get("author_name", [])
    publishers = doc.get("publisher", [])
    languages = doc.get("language", [])
    subjects = doc.get("subject", [])

    cover_url = None
    if doc.get("cover_edition_key"):
        cover_url = f"https://covers.openlibrary.org/b/olid/{doc['cover_edition_key']}-L.jpg"

    return {
        "title": doc.get("title", ""),
        "author": ", ".join(author_names) if author_names else "",
        "authors": author_names,
        "publisher": publishers[0] if publishers else None,
        "year": doc.get("first_publish_year"),
        "language": languages[0] if languages else None,
        "description": None,
        "pages": doc.get("number_of_pages_median"),
        "cover_url": cover_url,
        "genre": subjects[0] if subjects else None,
    }


def _parse_google_books(info: dict) -> dict:
    authors = info.get("authors", [])
    images = info.get("imageLinks", {})
    cover_url = images.get("extraLarge") or images.get("large") or images.get("thumbnail")
    categories = info.get("categories", [])

    return {
        "title": info.get("title", ""),
        "author": ", ".join(authors) if authors else "",
        "authors": authors,
        "publisher": info.get("publisher"),
        "year": _extract_year(info.get("publishedDate", "")),
        "language": info.get("language"),
        "description": info.get("description"),
        "pages": info.get("pageCount"),
        "cover_url": cover_url,
        "genre": categories[0] if categories else None,
    }


async def lookup_isbn(isbn: str) -> Optional[dict]:
    isbn = normalize_isbn(isbn)

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        # 1. Open Library /api/books (most complete data)
        try:
            resp = await client.get(
                OPENLIBRARY_API,
                params={"bibkeys": f"ISBN:{isbn}", "jscmd": "data", "format": "json"},
            )
            resp.raise_for_status()
            data = resp.json()
            key = f"ISBN:{isbn}"
            if key in data:
                result = _parse_openlibrary(data[key])
                result.update({"isbn": isbn, "source": "openlibrary"})
                return result
        except Exception:
            pass

        # 2. Open Library /search.json fallback
        try:
            resp = await client.get(OPENLIBRARY_SEARCH, params={"isbn": isbn, "limit": 1})
            resp.raise_for_status()
            docs = resp.json().get("docs", [])
            if docs:
                result = _parse_openlibrary_search(docs[0])
                result.update({"isbn": isbn, "source": "openlibrary_search"})
                return result
        except Exception:
            pass

        # 3. Google Books fallback
        try:
            resp = await client.get(GOOGLE_BOOKS_API, params={"q": f"isbn:{isbn}"})
            resp.raise_for_status()
            items = resp.json().get("items", [])
            if items:
                result = _parse_google_books(items[0].get("volumeInfo", {}))
                result.update({"isbn": isbn, "source": "google_books"})
                return result
        except Exception:
            pass

    return None

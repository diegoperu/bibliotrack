import asyncio
import json
import logging
import re
import time
from typing import Optional

import httpx

logger = logging.getLogger("bibliotrack.isbn")

try:
    from isbnlib import meta as isbnlib_meta
    _SBN_AVAILABLE = True
except ImportError:
    isbnlib_meta = None
    _SBN_AVAILABLE = False
    logger.warning("isbnlib not installed — SBN lookup disabled. Install: pip install isbnlib isbnlib-sbn")

OPENLIBRARY_API    = "https://openlibrary.org/api/books"
OPENLIBRARY_SEARCH = "https://openlibrary.org/search.json"
GOOGLE_BOOKS_API   = "https://www.googleapis.com/books/v1/volumes"
TIMEOUT = 12.0

# Headers that mimic a browser for scraping fallback
_SCRAPE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "it-IT,it;q=0.9,en;q=0.5",
}


def normalize_isbn(isbn: str) -> str:
    return re.sub(r"[\s\-]", "", isbn).strip()


def is_valid_isbn(isbn: str) -> bool:
    return bool(re.match(r"^\d{10}$|^\d{13}$", isbn))


def _is_italian_isbn(isbn: str) -> bool:
    """Detect Italian publisher ISBNs (978-88-*, 979-12-*, ISBN-10 88-*)."""
    clean = isbn.replace("-", "").replace(" ", "")
    if len(clean) == 13:
        return clean.startswith("97888") or clean.startswith("97912")
    if len(clean) == 10:
        return clean.startswith("88")
    return False


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
        "title":     data.get("title", ""),
        "author":    ", ".join(authors) if authors else "",
        "authors":   authors,
        "publisher": publisher,
        "year":      _extract_year(data.get("publish_date", "")),
        "language":  language,
        "description": description,
        "pages":     data.get("number_of_pages"),
        "cover_url": cover_url,
        "genre":     genre,
    }


def _parse_openlibrary_search(doc: dict) -> dict:
    author_names = doc.get("author_name", [])
    publishers   = doc.get("publisher", [])
    languages    = doc.get("language", [])
    subjects     = doc.get("subject", [])

    cover_url = None
    if doc.get("cover_edition_key"):
        cover_url = f"https://covers.openlibrary.org/b/olid/{doc['cover_edition_key']}-L.jpg"

    return {
        "title":     doc.get("title", ""),
        "author":    ", ".join(author_names) if author_names else "",
        "authors":   author_names,
        "publisher": publishers[0] if publishers else None,
        "year":      doc.get("first_publish_year"),
        "language":  languages[0] if languages else None,
        "description": None,
        "pages":     doc.get("number_of_pages_median"),
        "cover_url": cover_url,
        "genre":     subjects[0] if subjects else None,
    }


def _parse_google_books(info: dict) -> dict:
    authors    = info.get("authors", [])
    images     = info.get("imageLinks", {})
    cover_url  = images.get("extraLarge") or images.get("large") or images.get("thumbnail")
    categories = info.get("categories", [])

    return {
        "title":     info.get("title", ""),
        "author":    ", ".join(authors) if authors else "",
        "authors":   authors,
        "publisher": info.get("publisher"),
        "year":      _extract_year(info.get("publishedDate", "")),
        "language":  info.get("language"),
        "description": info.get("description"),
        "pages":     info.get("pageCount"),
        "cover_url": cover_url,
        "genre":     categories[0] if categories else None,
    }


def _extract_jsonld_books(html: str) -> list[dict]:
    """Return all JSON-LD objects that look like a Book or Product from an HTML page."""
    pattern = r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>'
    results = []
    for raw in re.findall(pattern, html, re.DOTALL | re.IGNORECASE):
        try:
            blob = json.loads(raw.strip())
        except (json.JSONDecodeError, ValueError):
            continue
        items = blob if isinstance(blob, list) else [blob]
        for item in items:
            if isinstance(item, dict) and item.get("@type") in ("Book", "Product"):
                results.append(item)
    return results


def _parse_jsonld_item(item: dict, isbn: str, source: str) -> Optional[dict]:
    """Convert a JSON-LD Book/Product object to our internal dict."""
    title = item.get("name") or item.get("title", "")
    if not title:
        return None

    # Author
    author_data = item.get("author", {})
    if isinstance(author_data, list):
        authors = [a.get("name", "") for a in author_data if isinstance(a, dict)]
    elif isinstance(author_data, dict):
        authors = [author_data.get("name", "")]
    else:
        authors = []
    author = ", ".join(a for a in authors if a)

    # Publisher
    pub_data = item.get("publisher", {})
    if isinstance(pub_data, dict):
        publisher = pub_data.get("name")
    elif isinstance(pub_data, str):
        publisher = pub_data
    else:
        publisher = None

    # Year
    date_raw = item.get("datePublished") or item.get("copyrightYear", "")
    year = _extract_year(str(date_raw)) if date_raw else None

    # Cover
    image = item.get("image")
    if isinstance(image, str):
        cover_url = image
    elif isinstance(image, dict):
        cover_url = image.get("url") or image.get("contentUrl")
    elif isinstance(image, list) and image:
        first = image[0]
        cover_url = first if isinstance(first, str) else (first.get("url") if isinstance(first, dict) else None)
    else:
        cover_url = None

    # Pages
    pages_raw = item.get("numberOfPages")
    try:
        pages = int(pages_raw) if pages_raw else None
    except (ValueError, TypeError):
        pages = None

    # Language
    lang = item.get("inLanguage")
    language = lang if isinstance(lang, str) else None
    if language and language.lower() in ("it", "italian", "italiano"):
        language = "ita"

    return {
        "title":       title,
        "author":      author,
        "authors":     authors,
        "publisher":   publisher,
        "year":        year,
        "language":    language,
        "description": item.get("description"),
        "pages":       pages,
        "cover_url":   cover_url,
        "genre":       None,
        "isbn":        isbn,
        "source":      source,
    }


async def _lookup_sbn(isbn: str) -> Optional[dict]:
    """Query OPAC SBN via isbnlib (sync, run in thread). Returns parsed result or None."""
    if not _SBN_AVAILABLE:
        logger.debug("isbn_lookup sbn skip: isbnlib not installed isbn=%s", isbn)
        return None
    try:
        data = await asyncio.to_thread(isbnlib_meta, isbn, service="sbn")
        if not data or not data.get("Title"):
            logger.debug("isbn_lookup sbn empty response isbn=%s", isbn)
            return None
        authors = data.get("Authors", [])
        lang = (data.get("Language") or "").lower()
        if lang == "it":
            lang = "ita"
        return {
            "title":     data.get("Title", ""),
            "author":    ", ".join(authors) if authors else "",
            "authors":   authors,
            "publisher": data.get("Publisher") or None,
            "year":      _extract_year(data.get("Year") or ""),
            "language":  lang or None,
            "description": None,
            "pages":     None,
            "cover_url": f"https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg",
            "genre":     None,
            "isbn":      isbn,
            "source":    "sbn",
        }
    except Exception as exc:
        logger.warning("isbn_lookup sbn error isbn=%s: %s", isbn, exc)
        return None


async def _lookup_web_scrape(isbn: str, client: httpx.AsyncClient) -> Optional[dict]:
    """
    Hidden fallback: scrape major Italian book retailers for JSON-LD metadata.
    Tries IBS.it (Italy's largest book retailer) and Feltrinelli.
    This source is intentionally NOT exposed in user-facing error messages.
    """
    targets = [
        ("ibs",         f"https://www.ibs.it/search/?ts=as&type=book&query={isbn}"),
        ("feltrinelli", f"https://www.lafeltrinelli.it/ricerca/q/{isbn}"),
    ]

    for source, url in targets:
        try:
            logger.debug("isbn_lookup web_scrape source=%s isbn=%s url=%s", source, isbn, url)
            resp = await client.get(url, headers=_SCRAPE_HEADERS, follow_redirects=True)
            logger.debug("isbn_lookup web_scrape source=%s isbn=%s status=%s", source, isbn, resp.status_code)
            if resp.status_code != 200:
                continue
            candidates = _extract_jsonld_books(resp.text)
            logger.debug("isbn_lookup web_scrape source=%s isbn=%s jsonld_count=%d", source, isbn, len(candidates))
            for item in candidates:
                result = _parse_jsonld_item(item, isbn, source)
                if result and result.get("title"):
                    return result
        except Exception as exc:
            logger.debug("isbn_lookup web_scrape source=%s isbn=%s error: %s", source, isbn, exc)
            continue

    return None


async def lookup_isbn(isbn: str) -> Optional[dict]:
    isbn = normalize_isbn(isbn)
    t0 = time.monotonic()
    logger.info("isbn_lookup start isbn=%s italian=%s", isbn, _is_italian_isbn(isbn))

    # Level 1: OPAC SBN — Italian ISBNs only (978-88-*, 979-12-*, ISBN-10 88-*)
    if _is_italian_isbn(isbn):
        logger.info("isbn_lookup level=1 source=sbn isbn=%s", isbn)
        result = await _lookup_sbn(isbn)
        if result:
            logger.info("isbn_lookup success source=sbn isbn=%s title=%r elapsed=%.2fs",
                        isbn, result.get("title"), time.monotonic() - t0)
            return result
        logger.warning("isbn_lookup miss source=sbn isbn=%s", isbn)

    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
        # Level 2: Open Library /api/books
        logger.info("isbn_lookup level=2 source=openlibrary isbn=%s", isbn)
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
                logger.info("isbn_lookup success source=openlibrary isbn=%s title=%r elapsed=%.2fs",
                            isbn, result.get("title"), time.monotonic() - t0)
                return result
            logger.warning("isbn_lookup miss source=openlibrary isbn=%s (key not in response)", isbn)
        except Exception as exc:
            logger.warning("isbn_lookup error source=openlibrary isbn=%s: %s", isbn, exc)

        # Level 3: Open Library /search.json
        logger.info("isbn_lookup level=3 source=openlibrary_search isbn=%s", isbn)
        try:
            resp = await client.get(OPENLIBRARY_SEARCH, params={"isbn": isbn, "limit": 1})
            resp.raise_for_status()
            docs = resp.json().get("docs", [])
            if docs:
                result = _parse_openlibrary_search(docs[0])
                result.update({"isbn": isbn, "source": "openlibrary_search"})
                logger.info("isbn_lookup success source=openlibrary_search isbn=%s title=%r elapsed=%.2fs",
                            isbn, result.get("title"), time.monotonic() - t0)
                return result
            logger.warning("isbn_lookup miss source=openlibrary_search isbn=%s (no docs)", isbn)
        except Exception as exc:
            logger.warning("isbn_lookup error source=openlibrary_search isbn=%s: %s", isbn, exc)

        # Level 4: Google Books
        logger.info("isbn_lookup level=4 source=google_books isbn=%s", isbn)
        try:
            resp = await client.get(GOOGLE_BOOKS_API, params={"q": f"isbn:{isbn}"})
            resp.raise_for_status()
            items = resp.json().get("items", [])
            if items:
                result = _parse_google_books(items[0].get("volumeInfo", {}))
                result.update({"isbn": isbn, "source": "google_books"})
                logger.info("isbn_lookup success source=google_books isbn=%s title=%r elapsed=%.2fs",
                            isbn, result.get("title"), time.monotonic() - t0)
                return result
            logger.warning("isbn_lookup miss source=google_books isbn=%s (no items)", isbn)
        except Exception as exc:
            logger.warning("isbn_lookup error source=google_books isbn=%s: %s", isbn, exc)

        # Level 5: Web scraping fallback (IBS.it + Feltrinelli) — not exposed to user
        logger.info("isbn_lookup level=5 source=web_scrape isbn=%s", isbn)
        result = await _lookup_web_scrape(isbn, client)
        if result:
            logger.info("isbn_lookup success source=%s isbn=%s title=%r elapsed=%.2fs",
                        result.get("source"), isbn, result.get("title"), time.monotonic() - t0)
            return result
        logger.warning("isbn_lookup miss source=web_scrape isbn=%s", isbn)

    elapsed = time.monotonic() - t0
    logger.error(
        "isbn_lookup failed isbn=%s all_sources_exhausted elapsed=%.2fs "
        "(sbn=%s ol=%s ol_search=%s google=%s web_scrape=%s)",
        isbn, elapsed,
        "skip" if not _is_italian_isbn(isbn) else "miss",
        "miss", "miss", "miss", "miss",
    )
    return None

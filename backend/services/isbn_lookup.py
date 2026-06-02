import asyncio
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

# IBS.it uses Algolia for search. These are the public read-only search keys
# embedded in IBS.it's frontend JavaScript (exposed to every browser visitor).
_IBS_ALGOLIA_APP_ID  = "FBVFK8AIGY"
_IBS_ALGOLIA_API_KEY = "460ca8aeaa21b30a35784e7125bfca37"
_IBS_ALGOLIA_INDEX   = "prd_IBS"


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


def _parse_ibs_algolia_hit(hit: dict, isbn: str) -> Optional[dict]:
    """Convert an IBS.it Algolia search hit to our internal dict."""
    title = hit.get("title", "")
    if not title:
        return None

    authors_raw = hit.get("authors") or []
    authors = [a for a in authors_raw if a]
    author = ", ".join(authors)

    publishers_raw = hit.get("publisher") or []
    publisher = publishers_raw[0] if publishers_raw else None

    year = _extract_year(str(hit.get("editionDate") or hit.get("publicationDate") or ""))

    # IBS cover: replace default size (200) with larger (400)
    image_url = hit.get("image") or ""
    if image_url:
        cover_url = re.sub(r"_0_0_\d+_0_0", "_0_0_400_0_0", image_url)
    else:
        cover_url = None

    # Use the most specific category as genre
    categories = hit.get("categories") or hit.get("department") or []
    genre = categories[0] if categories else None

    return {
        "title":       title,
        "author":      author,
        "authors":     authors,
        "publisher":   publisher,
        "year":        year,
        "language":    "ita",  # IBS.it is Italian-only catalog
        "description": None,
        "pages":       None,
        "cover_url":   cover_url,
        "genre":       genre,
        "isbn":        isbn,
        "source":      "ibs",
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
    Hidden fallback: query IBS.it via their public Algolia search index.
    IBS.it is Italy's largest book retailer and has excellent Italian coverage.
    The Algolia App ID and read-only API key are public (embedded in IBS.it's
    frontend JS, visible to every browser visitor).
    This source is intentionally NOT exposed in user-facing error messages.
    """
    url = f"https://{_IBS_ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/{_IBS_ALGOLIA_INDEX}/query"
    headers = {
        "X-Algolia-Application-Id": _IBS_ALGOLIA_APP_ID,
        "X-Algolia-API-Key": _IBS_ALGOLIA_API_KEY,
        "Content-Type": "application/json",
    }
    payload = {
        "query": isbn,
        "hitsPerPage": 3,
        "filters": "productType:ITBOOK",  # books only, not e-books or accessories
    }

    try:
        logger.debug("isbn_lookup ibs_algolia isbn=%s", isbn)
        resp = await client.post(url, headers=headers, json=payload)
        logger.debug("isbn_lookup ibs_algolia isbn=%s status=%s", isbn, resp.status_code)
        if resp.status_code != 200:
            logger.warning("isbn_lookup ibs_algolia isbn=%s non-200 status=%s", isbn, resp.status_code)
            return None

        hits = resp.json().get("hits", [])
        logger.debug("isbn_lookup ibs_algolia isbn=%s hits=%d", isbn, len(hits))

        for hit in hits:
            # Only accept exact ISBN match (query is fuzzy — avoid false positives)
            if hit.get("ean") == isbn or hit.get("objectID") == isbn:
                result = _parse_ibs_algolia_hit(hit, isbn)
                if result:
                    return result

        logger.warning("isbn_lookup ibs_algolia isbn=%s no exact ean match in %d hits", isbn, len(hits))
    except Exception as exc:
        logger.warning("isbn_lookup ibs_algolia isbn=%s error: %s", isbn, exc)

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

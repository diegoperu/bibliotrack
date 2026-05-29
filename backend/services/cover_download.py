import httpx
from pathlib import Path
from typing import Optional

OPENLIBRARY_COVER = "https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg"
TIMEOUT = 15.0
MIN_SIZE = 1000  # bytes — anything smaller is a placeholder/error image


async def download_cover(isbn: str, covers_dir: Path, fallback_url: Optional[str] = None) -> Optional[str]:
    """Download cover for isbn. Returns 'covers/{isbn}.jpg' path or None."""
    covers_dir.mkdir(parents=True, exist_ok=True)
    dest = covers_dir / f"{isbn}.jpg"

    urls = [OPENLIBRARY_COVER.format(isbn=isbn)]
    if fallback_url and fallback_url not in urls:
        urls.append(fallback_url)

    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
        for url in urls:
            try:
                resp = await client.get(url)
                if resp.status_code == 200 and len(resp.content) > MIN_SIZE:
                    dest.write_bytes(resp.content)
                    return f"covers/{isbn}.jpg"
            except Exception:
                continue

    return None

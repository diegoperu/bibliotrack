import io
import json
import logging
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from config import settings
from models.book import Book, BookStatus
from models.loan import Borrower, Loan
from schemas.export import BookExport, ExportBundle, ImportResult, LoanExport, SUPPORTED_SCHEMA_VERSION
from services.cover_download import OPENLIBRARY_COVER, download_cover
from services.isbn_lookup import is_valid_isbn, normalize_isbn

logger = logging.getLogger("bibliotrack.export")

SOURCE = "bibliotrack-web"
SOURCE_VERSION = "1.0.0"
_VALID_STATUSES = {s.value for s in BookStatus}


def _book_cover_url(book: Book) -> Optional[str]:
    if book.cover_path and book.cover_path.startswith("http"):
        return book.cover_path
    if book.isbn:
        return OPENLIBRARY_COVER.format(isbn=book.isbn)
    return None


def _local_cover_file(book: Book) -> Optional[Path]:
    if not book.cover_path or book.cover_path.startswith("http"):
        return None
    path = settings.COVERS_DIR / Path(book.cover_path).name
    return path if path.is_file() else None


def _fetch_books(db: Session, owner_id: int) -> List[Book]:
    return (
        db.query(Book)
        .options(joinedload(Book.loans).joinedload(Loan.borrower))
        .filter(Book.owner_id == owner_id)
        .order_by(Book.id)
        .all()
    )


def _to_book_export(book: Book) -> BookExport:
    loans = [
        LoanExport(
            borrower_name=l.borrower.display_name,
            loaned_at=l.loaned_at,
            returned_at=l.returned_at,
            notes=l.notes,
        )
        for l in book.loans
    ] or None
    return BookExport(
        isbn=book.isbn,
        isbn10=None,
        title=book.title,
        author=book.author,
        authors=book.authors,
        publisher=book.publisher,
        edition=book.edition,
        year=book.year,
        language=book.language,
        genre=book.genre,
        description=book.description,
        pages=book.pages,
        cover_url=_book_cover_url(book),
        rating=book.rating,
        notes=book.notes,
        status=book.status.value,
        added_at=book.added_at,
        updated_at=book.updated_at,
        loans=loans,
    )


def build_export_bundle(db: Session, owner_id: int) -> ExportBundle:
    books = _fetch_books(db, owner_id)
    return ExportBundle(
        schema_version=SUPPORTED_SCHEMA_VERSION,
        exported_at=datetime.now(timezone.utc),
        source=SOURCE,
        source_version=SOURCE_VERSION,
        books=[_to_book_export(b) for b in books],
    )


def build_export_zip(db: Session, owner_id: int) -> bytes:
    books = _fetch_books(db, owner_id)
    bundle = ExportBundle(
        schema_version=SUPPORTED_SCHEMA_VERSION,
        exported_at=datetime.now(timezone.utc),
        source=SOURCE,
        source_version=SOURCE_VERSION,
        books=[_to_book_export(b) for b in books],
    )

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("export.json", bundle.model_dump_json(indent=2))
        seen = set()
        for book in books:
            cover_file = _local_cover_file(book)
            if cover_file and book.isbn and book.isbn not in seen:
                zf.write(cover_file, f"covers/{book.isbn}{cover_file.suffix}")
                seen.add(book.isbn)
    logger.info("export_zip owner_id=%s books=%d covers=%d", owner_id, len(books), len(seen))
    buf.seek(0)
    return buf.getvalue()


def _get_or_create_borrower(db: Session, owner_id: int, display_name: str) -> Borrower:
    normalized = display_name.strip().lower()
    borrower = (
        db.query(Borrower)
        .filter(Borrower.owner_id == owner_id, Borrower.name == normalized)
        .first()
    )
    if borrower:
        return borrower
    borrower = Borrower(name=normalized, display_name=display_name.strip(), owner_id=owner_id)
    db.add(borrower)
    db.flush()
    return borrower


def _is_duplicate(db: Session, owner_id: int, isbn: Optional[str], title: str, author: Optional[str]) -> bool:
    q = db.query(Book).filter(Book.owner_id == owner_id)
    if isbn:
        return q.filter(Book.isbn == isbn).first() is not None
    return (
        q.filter(
            func.lower(Book.title) == title.lower(),
            func.lower(Book.author) == (author or "").lower(),
        ).first()
        is not None
    )


async def import_export_zip(db: Session, owner_id: int, zip_bytes: bytes) -> ImportResult:
    imported = 0
    skipped = 0
    errors: List[str] = []

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        try:
            raw = json.loads(zf.read("export.json"))
        except KeyError:
            raise ValueError("export.json non trovato nello zip")
        except json.JSONDecodeError as exc:
            raise ValueError(f"export.json non è JSON valido: {exc}")

        schema_version = raw.get("schema_version", 1)
        if schema_version > SUPPORTED_SCHEMA_VERSION:
            errors.append(
                f"Il file è stato creato con schema_version {schema_version}, più recente di quella "
                f"supportata ({SUPPORTED_SCHEMA_VERSION}). Alcuni campi potrebbero non essere importati "
                "correttamente."
            )

        cover_names = [n for n in zf.namelist() if n.startswith("covers/")]

        for raw_book in raw.get("books", []):
            try:
                book_export = BookExport.model_validate(raw_book)
            except Exception as exc:
                errors.append(f"Libro non valido, saltato: {exc}")
                continue

            isbn = normalize_isbn(book_export.isbn) if book_export.isbn else None
            if isbn and not is_valid_isbn(isbn):
                # untrusted input: never let a malformed isbn reach filesystem paths (download_cover,
                # zip entry names) — treat as no-isbn instead of raising, since it's still importable
                isbn = None

            if _is_duplicate(db, owner_id, isbn, book_export.title, book_export.author):
                skipped += 1
                continue

            status_value = book_export.status if book_export.status in _VALID_STATUSES else BookStatus.to_read.value

            cover_path = None
            cover_entry = next((n for n in cover_names if isbn and n.startswith(f"covers/{isbn}.")), None)
            if cover_entry:
                dest = settings.COVERS_DIR / Path(cover_entry).name
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(zf.read(cover_entry))
                cover_path = f"covers/{dest.name}"
            elif isbn:
                cover_path = await download_cover(isbn, settings.COVERS_DIR, fallback_url=book_export.cover_url)

            book = Book(
                isbn=isbn,
                title=book_export.title,
                author=book_export.author or "",
                authors=book_export.authors,
                publisher=book_export.publisher,
                edition=book_export.edition,
                year=book_export.year,
                language=book_export.language,
                genre=book_export.genre,
                description=book_export.description,
                pages=book_export.pages,
                cover_path=cover_path or book_export.cover_url,
                rating=book_export.rating,
                notes=book_export.notes,
                status=status_value,
                added_at=book_export.added_at,
                owner_id=owner_id,
            )
            db.add(book)
            db.flush()

            for loan_export in (book_export.loans or []):
                borrower = _get_or_create_borrower(db, owner_id, loan_export.borrower_name)
                db.add(
                    Loan(
                        book_id=book.id,
                        borrower_id=borrower.id,
                        owner_id=owner_id,
                        loaned_at=loan_export.loaned_at,
                        returned_at=loan_export.returned_at,
                        notes=loan_export.notes,
                    )
                )

            imported += 1

    db.commit()
    logger.info("import_zip owner_id=%s imported=%d skipped=%d errors=%d", owner_id, imported, skipped, len(errors))
    return ImportResult(imported=imported, skipped=skipped, errors=errors)

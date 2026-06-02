import logging
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from models.book import Book, BookStatus
from models.user import User
from schemas.book import BookResponse
from services.isbn_lookup import lookup_isbn, normalize_isbn, is_valid_isbn
from services.cover_download import download_cover
from middleware.auth import get_current_user
from config import settings

logger = logging.getLogger("bibliotrack.isbn")

router = APIRouter(prefix="/isbn", tags=["isbn"])


class ImportOptions(BaseModel):
    genre: Optional[str] = None
    notes: Optional[str] = None
    status: BookStatus = BookStatus.to_read
    rating: Optional[int] = None


@router.get("/{isbn}")
async def get_isbn_metadata(isbn: str):
    isbn = normalize_isbn(isbn)
    if not is_valid_isbn(isbn):
        logger.warning("isbn_request invalid isbn=%s", isbn)
        raise HTTPException(status_code=400, detail="Invalid ISBN format (must be 10 or 13 digits)")
    data = await lookup_isbn(isbn)
    if not data:
        logger.error("isbn_request not_found isbn=%s — returned 404 to client", isbn)
        raise HTTPException(
            status_code=404,
            detail="ISBN non trovato in Open Library né in Google Books. Prova inserimento manuale.",
        )
    logger.info("isbn_request found isbn=%s source=%s title=%r", isbn, data.get("source"), data.get("title"))
    return data


@router.post("/{isbn}/import", response_model=BookResponse, status_code=status.HTTP_201_CREATED)
async def import_isbn(
    isbn: str,
    options: ImportOptions = ImportOptions(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    isbn = normalize_isbn(isbn)
    if not is_valid_isbn(isbn):
        raise HTTPException(status_code=400, detail="Invalid ISBN format (must be 10 or 13 digits)")

    data = await lookup_isbn(isbn)
    if not data:
        raise HTTPException(status_code=404, detail="ISBN not found in any source")

    cover_path = await download_cover(isbn, settings.COVERS_DIR, fallback_url=data.get("cover_url"))

    book = Book(
        isbn=isbn,
        title=data.get("title", ""),
        author=data.get("author", ""),
        authors=data.get("authors"),
        publisher=data.get("publisher"),
        year=data.get("year"),
        language=data.get("language"),
        description=data.get("description"),
        pages=data.get("pages"),
        cover_path=cover_path or data.get("cover_url"),
        genre=options.genre or data.get("genre"),
        notes=options.notes,
        status=options.status,
        rating=options.rating,
        owner_id=current_user.id,
    )
    db.add(book)
    db.commit()
    db.refresh(book)
    return book

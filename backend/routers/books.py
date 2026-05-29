from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
from database import get_db
from models.book import Book, BookStatus
from models.user import User, UserRole
from schemas.book import BookCreate, BookUpdate, BookResponse
from middleware.auth import get_current_user

router = APIRouter(prefix="/books", tags=["books"])

_SORTABLE = {"title", "author", "year", "genre", "publisher", "added_at", "updated_at", "status"}


def _get_book_or_403(book_id: int, db: Session, user: User) -> Book:
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if user.role != UserRole.admin and book.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return book


@router.get("/", response_model=List[BookResponse])
def list_books(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    author: Optional[str] = Query(None),
    genre: Optional[str] = Query(None),
    publisher: Optional[str] = Query(None),
    status_filter: Optional[BookStatus] = Query(None, alias="status"),
    language: Optional[str] = Query(None),
    sort_by: str = Query("added_at"),
    order: str = Query("desc"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    q = db.query(Book)
    if current_user.role != UserRole.admin:
        q = q.filter(Book.owner_id == current_user.id)
    if author:
        q = q.filter(Book.author.ilike(f"%{author}%"))
    if genre:
        q = q.filter(Book.genre.ilike(f"%{genre}%"))
    if publisher:
        q = q.filter(Book.publisher.ilike(f"%{publisher}%"))
    if status_filter:
        q = q.filter(Book.status == status_filter)
    if language:
        q = q.filter(Book.language == language)
    sort_col = getattr(Book, sort_by if sort_by in _SORTABLE else "added_at")
    q = q.order_by(sort_col.desc() if order == "desc" else sort_col.asc())
    return q.offset(skip).limit(limit).all()


@router.post("/", response_model=BookResponse, status_code=status.HTTP_201_CREATED)
def create_book(
    book_data: BookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    book = Book(**book_data.model_dump(), owner_id=current_user.id)
    db.add(book)
    db.commit()
    db.refresh(book)
    return book


@router.get("/{book_id}", response_model=BookResponse)
def get_book(book_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _get_book_or_403(book_id, db, current_user)


@router.patch("/{book_id}", response_model=BookResponse)
def update_book(
    book_id: int,
    book_data: BookUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    book = _get_book_or_403(book_id, db, current_user)
    for field, value in book_data.model_dump(exclude_unset=True).items():
        setattr(book, field, value)
    book.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(book)
    return book


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_book(book_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    book = _get_book_or_403(book_id, db, current_user)
    db.delete(book)
    db.commit()

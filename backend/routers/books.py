from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime, timezone
import io
import zipfile
from database import get_db
from models.book import Book, BookStatus
from models.loan import Loan
from models.user import User, UserRole
from schemas.book import BookCreate, BookUpdate, BookResponse, BookDetailResponse
from schemas.loan import LoanOut, loan_to_out
from schemas.export import ImportResult
from services.export_service import build_export_zip, import_export_zip
from middleware.auth import get_current_user

router = APIRouter(prefix="/books", tags=["books"])

_SORTABLE = {"title", "author", "year", "genre", "publisher", "added_at", "updated_at", "status"}
_MAX_IMPORT_SIZE = 50 * 1024 * 1024  # 50MB — generous for a personal library export


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
    all_users: bool = Query(False),
    with_loan_status: bool = Query(False),
):
    q = db.query(Book)
    # all_users=true is admin-only and used exclusively by the admin panel.
    # The personal library always filters by owner, regardless of role.
    if not (all_users and current_user.role == UserRole.admin):
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
    books = q.offset(skip).limit(limit).all()

    if not with_loan_status:
        return books

    book_ids = [b.id for b in books]
    active_loan_book_ids = set(
        row[0]
        for row in db.query(Loan.book_id)
        .filter(Loan.book_id.in_(book_ids), Loan.returned_at == None)  # noqa: E711
        .all()
    )
    return [
        BookResponse.model_validate(b).model_copy(update={"is_on_loan": b.id in active_loan_book_ids})
        for b in books
    ]


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


@router.get("/export")
def export_books(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    zip_bytes = build_export_zip(db, current_user.id)
    filename = f"bibliotrack-export-{datetime.now(timezone.utc):%Y%m%d-%H%M%S}.zip"
    return StreamingResponse(
        io.BytesIO(zip_bytes),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/import", response_model=ImportResult)
async def import_books(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content = await file.read()
    if len(content) > _MAX_IMPORT_SIZE:
        raise HTTPException(status_code=413, detail="File troppo grande (max 50MB)")
    try:
        return await import_export_zip(db, current_user.id, content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="File non è un archivio zip valido")


@router.get("/{book_id}", response_model=BookDetailResponse)
def get_book(book_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    book = _get_book_or_403(book_id, db, current_user)
    active_loan_obj = (
        db.query(Loan)
        .options(joinedload(Loan.book), joinedload(Loan.borrower))
        .filter(Loan.book_id == book.id, Loan.returned_at == None)  # noqa: E711
        .first()
    )
    detail = BookDetailResponse.model_validate(book)
    if active_loan_obj:
        detail = detail.model_copy(update={"active_loan": loan_to_out(active_loan_obj)})
    return detail


@router.get("/{book_id}/loans", response_model=List[LoanOut])
def get_book_loans(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    book = _get_book_or_403(book_id, db, current_user)
    loans = (
        db.query(Loan)
        .options(joinedload(Loan.book), joinedload(Loan.borrower))
        .filter(Loan.book_id == book.id)
        .order_by(Loan.loaned_at.desc())
        .all()
    )
    return [loan_to_out(l) for l in loans]


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

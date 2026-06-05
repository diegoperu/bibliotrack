from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime
from models.book import BookStatus
from schemas.loan import LoanOut


class BookCreate(BaseModel):
    title: str
    author: str
    isbn: Optional[str] = None
    authors: Optional[List[Any]] = None
    publisher: Optional[str] = None
    edition: Optional[str] = None
    year: Optional[int] = None
    language: Optional[str] = None
    genre: Optional[str] = None
    description: Optional[str] = None
    cover_path: Optional[str] = None
    pages: Optional[int] = None
    rating: Optional[int] = None
    notes: Optional[str] = None
    status: BookStatus = BookStatus.to_read


class BookUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    isbn: Optional[str] = None
    authors: Optional[List[Any]] = None
    publisher: Optional[str] = None
    edition: Optional[str] = None
    year: Optional[int] = None
    language: Optional[str] = None
    genre: Optional[str] = None
    description: Optional[str] = None
    cover_path: Optional[str] = None
    pages: Optional[int] = None
    rating: Optional[int] = None
    notes: Optional[str] = None
    status: Optional[BookStatus] = None


class BookResponse(BookCreate):
    id: int
    owner_id: int
    added_at: datetime
    updated_at: datetime
    is_on_loan: Optional[bool] = None

    model_config = {"from_attributes": True}


class BookDetailResponse(BookResponse):
    active_loan: Optional[LoanOut] = None

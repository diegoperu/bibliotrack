from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime

SUPPORTED_SCHEMA_VERSION = 2


class LoanExport(BaseModel):
    borrower_name: str
    loaned_at: datetime
    returned_at: Optional[datetime] = None
    notes: Optional[str] = None


class BookExport(BaseModel):
    isbn: Optional[str] = None
    isbn10: Optional[str] = None
    title: str
    author: Optional[str] = None
    authors: Optional[List[Any]] = None
    publisher: Optional[str] = None
    edition: Optional[str] = None
    year: Optional[int] = None
    language: Optional[str] = None
    genre: Optional[str] = None
    description: Optional[str] = None
    pages: Optional[int] = None
    cover_url: Optional[str] = None
    rating: Optional[int] = None
    notes: Optional[str] = None
    status: str
    added_at: datetime
    updated_at: Optional[datetime] = None
    loans: Optional[List[LoanExport]] = None


class ExportBundle(BaseModel):
    schema_version: int
    exported_at: datetime
    source: str
    source_version: Optional[str] = None
    books: List[BookExport]


class ImportResult(BaseModel):
    imported: int
    skipped: int
    errors: List[str]

from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime, timezone


class BorrowerSuggestion(BaseModel):
    id: int
    display_name: str

    model_config = {"from_attributes": True}


class BorrowerOut(BaseModel):
    id: int
    display_name: str
    name: str
    owner_id: int
    created_at: datetime
    loan_count: int
    active_loan_count: int


class LoanCreate(BaseModel):
    book_id: int
    borrower_name: str
    notes: Optional[str] = None

    @field_validator("borrower_name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("borrower_name cannot be blank")
        return v


class LoanReturn(BaseModel):
    notes: Optional[str] = None


class LoanOut(BaseModel):
    id: int
    book_id: int
    book_title: str
    book_cover_path: Optional[str] = None
    book_cover_url: Optional[str] = None
    borrower_id: int
    borrower_display_name: str
    loaned_at: datetime
    returned_at: Optional[datetime] = None
    notes: Optional[str] = None
    is_active: bool
    duration_days: Optional[int] = None


class BorrowerDetail(BaseModel):
    id: int
    display_name: str
    total_loans: int
    active_loans: int
    loans: List[LoanOut]


def _ensure_tz(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def loan_to_out(loan) -> LoanOut:
    now = datetime.now(timezone.utc)
    loaned_at = _ensure_tz(loan.loaned_at)
    returned_at = _ensure_tz(loan.returned_at) if loan.returned_at else None
    end = returned_at or now
    duration_days = (end - loaned_at).days

    cover = loan.book.cover_path
    if cover and not cover.startswith("http"):
        cover_url = f"/static/{cover}"
    else:
        cover_url = cover

    return LoanOut(
        id=loan.id,
        book_id=loan.book_id,
        book_title=loan.book.title,
        book_cover_path=cover,
        book_cover_url=cover_url,
        borrower_id=loan.borrower_id,
        borrower_display_name=loan.borrower.display_name,
        loaned_at=loaned_at,
        returned_at=returned_at,
        notes=loan.notes,
        is_active=returned_at is None,
        duration_days=duration_days,
    )

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, timezone
from database import get_db
from models.book import Book
from models.loan import Borrower, Loan
from models.user import User, UserRole
from schemas.loan import (
    BorrowerDetail, BorrowerOut, BorrowerSuggestion,
    LoanCreate, LoanOut, LoanReturn, loan_to_out,
)
from middleware.auth import get_current_user

router = APIRouter(prefix="/loans", tags=["loans"])


def _get_loan_or_403(loan_id: int, db: Session, user: User) -> Loan:
    loan = (
        db.query(Loan)
        .options(joinedload(Loan.book), joinedload(Loan.borrower))
        .filter(Loan.id == loan_id)
        .first()
    )
    if not loan:
        raise HTTPException(status_code=404, detail="Prestito non trovato")
    if user.role != UserRole.admin and loan.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Non autorizzato")
    return loan


def _base_loan_query(db: Session, user: User):
    # Sempre filtrato per owner, anche per admin: /loans è la pagina prestiti
    # *personale* (stessa decisione presa per GET /books/ — fix c649fa1).
    # L'admin accede ai prestiti altrui solo via singolo libro/loan (_get_loan_or_403).
    return (
        db.query(Loan)
        .options(joinedload(Loan.book), joinedload(Loan.borrower))
        .filter(Loan.owner_id == user.id)
    )


@router.get("/active", response_model=List[LoanOut])
def list_active_loans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    loans = (
        _base_loan_query(db, current_user)
        .filter(Loan.returned_at == None)  # noqa: E711
        .order_by(Loan.loaned_at.asc())
        .all()
    )
    return [loan_to_out(l) for l in loans]


@router.get("/borrowers", response_model=List[BorrowerOut])
def list_borrowers(
    q: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Borrower).filter(Borrower.owner_id == current_user.id)
    if q:
        normalized_q = q.lower().strip()
        query = query.filter(Borrower.name.ilike(f"%{normalized_q}%"))
    borrowers = query.order_by(Borrower.display_name).all()

    if not borrowers:
        return []

    borrower_ids = [b.id for b in borrowers]
    total_counts = dict(
        db.query(Loan.borrower_id, func.count(Loan.id))
        .filter(Loan.borrower_id.in_(borrower_ids))
        .group_by(Loan.borrower_id)
        .all()
    )
    active_counts = dict(
        db.query(Loan.borrower_id, func.count(Loan.id))
        .filter(Loan.borrower_id.in_(borrower_ids), Loan.returned_at == None)  # noqa: E711
        .group_by(Loan.borrower_id)
        .all()
    )
    return [
        BorrowerOut(
            id=b.id,
            display_name=b.display_name,
            name=b.name,
            owner_id=b.owner_id,
            created_at=b.created_at,
            loan_count=total_counts.get(b.id, 0),
            active_loan_count=active_counts.get(b.id, 0),
        )
        for b in borrowers
    ]


@router.get("/borrowers/{borrower_id}", response_model=BorrowerDetail)
def get_borrower(
    borrower_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    borrower = db.query(Borrower).filter(Borrower.id == borrower_id).first()
    if not borrower:
        raise HTTPException(status_code=404, detail="Persona non trovata")
    if current_user.role != UserRole.admin and borrower.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Non autorizzato")

    loans = (
        db.query(Loan)
        .options(joinedload(Loan.book), joinedload(Loan.borrower))
        .filter(Loan.borrower_id == borrower_id)
        .order_by(Loan.loaned_at.desc())
        .all()
    )
    active = sum(1 for l in loans if l.returned_at is None)

    return BorrowerDetail(
        id=borrower.id,
        display_name=borrower.display_name,
        total_loans=len(loans),
        active_loans=active,
        loans=[loan_to_out(l) for l in loans],
    )


@router.get("", response_model=List[LoanOut])
def list_loans(
    active_only: bool = Query(False),
    borrower_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = _base_loan_query(db, current_user)
    if active_only:
        q = q.filter(Loan.returned_at == None)  # noqa: E711
    if borrower_id:
        q = q.filter(Loan.borrower_id == borrower_id)
    q = q.order_by(Loan.loaned_at.desc())
    skip = (page - 1) * page_size
    loans = q.offset(skip).limit(page_size).all()
    return [loan_to_out(l) for l in loans]


@router.post("", response_model=LoanOut, status_code=status.HTTP_201_CREATED)
def create_loan(
    loan_data: LoanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    book = db.query(Book).filter(Book.id == loan_data.book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Libro non trovato")
    if current_user.role != UserRole.admin and book.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Non autorizzato")

    active_loan = (
        db.query(Loan)
        .options(joinedload(Loan.borrower))
        .filter(Loan.book_id == book.id, Loan.returned_at == None)  # noqa: E711
        .first()
    )
    if active_loan:
        raise HTTPException(
            status_code=409,
            detail=f"Il libro è già in prestito a {active_loan.borrower.display_name}",
        )

    normalized = loan_data.borrower_name.lower().strip()
    borrower = (
        db.query(Borrower)
        .filter(Borrower.name == normalized, Borrower.owner_id == current_user.id)
        .first()
    )
    if not borrower:
        borrower = Borrower(
            name=normalized,
            display_name=loan_data.borrower_name.strip(),
            owner_id=current_user.id,
        )
        db.add(borrower)
        db.flush()

    loan = Loan(
        book_id=book.id,
        borrower_id=borrower.id,
        owner_id=current_user.id,
        notes=loan_data.notes,
    )
    db.add(loan)
    db.commit()

    loan = (
        db.query(Loan)
        .options(joinedload(Loan.book), joinedload(Loan.borrower))
        .filter(Loan.id == loan.id)
        .first()
    )
    return loan_to_out(loan)


@router.put("/{loan_id}/return", response_model=LoanOut)
def return_loan(
    loan_id: int,
    body: Optional[LoanReturn] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    loan = _get_loan_or_403(loan_id, db, current_user)

    if loan.returned_at is not None:
        raise HTTPException(status_code=409, detail="Il prestito è già stato restituito")

    loan.returned_at = datetime.now(timezone.utc)

    if body and body.notes:
        if loan.notes:
            loan.notes = f"{loan.notes}\nRestituzione: {body.notes}"
        else:
            loan.notes = f"Restituzione: {body.notes}"

    db.commit()
    db.refresh(loan)

    loan = (
        db.query(Loan)
        .options(joinedload(Loan.book), joinedload(Loan.borrower))
        .filter(Loan.id == loan.id)
        .first()
    )
    return loan_to_out(loan)

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from database import Base


class Borrower(Base):
    __tablename__ = "borrowers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    display_name = Column(String(200), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (UniqueConstraint("name", "owner_id", name="uq_borrower_name_owner"),)

    loans = relationship("Loan", back_populates="borrower")
    owner = relationship("User")


class Loan(Base):
    __tablename__ = "loans"

    id = Column(Integer, primary_key=True, index=True)
    book_id = Column(Integer, ForeignKey("books.id", ondelete="CASCADE"), nullable=False)
    # book deletion cascades to loans — loan history is lost when a book is deleted
    borrower_id = Column(Integer, ForeignKey("borrowers.id", ondelete="RESTRICT"), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    loaned_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    returned_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)

    book = relationship("Book", back_populates="loans")
    borrower = relationship("Borrower", back_populates="loans")
    owner = relationship("User")

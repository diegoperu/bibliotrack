import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from database import Base


class BookStatus(str, enum.Enum):
    read = "read"
    reading = "reading"
    to_read = "to_read"
    abandoned = "abandoned"


class Book(Base):
    __tablename__ = "books"

    id = Column(Integer, primary_key=True, index=True)
    isbn = Column(String(20), nullable=True, index=True)
    title = Column(String(500), nullable=False)
    author = Column(String(500), nullable=False)
    authors = Column(JSON, nullable=True)
    publisher = Column(String(255), nullable=True)
    edition = Column(String(100), nullable=True)
    year = Column(Integer, nullable=True)
    language = Column(String(50), nullable=True)
    genre = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    cover_path = Column(String(500), nullable=True)
    pages = Column(Integer, nullable=True)
    rating = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(SAEnum(BookStatus), default=BookStatus.to_read, nullable=False)
    added_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    owner = relationship("User", back_populates="books")
    # ORM-level cascade: senza, l'ORM tenta UPDATE loans SET book_id=NULL alla
    # cancellazione del libro → NOT NULL violation (il CASCADE a livello DB non
    # scatta perché l'ORM interviene prima)
    loans = relationship(
        "Loan", back_populates="book", order_by="Loan.loaned_at.desc()",
        cascade="all, delete-orphan",
    )

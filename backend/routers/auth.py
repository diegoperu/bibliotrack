from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from database import get_db
from models.user import User
from schemas.user import UserResponse
from services.auth_service import (
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
)
from middleware.auth import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

# Hash fittizio confrontato quando lo username non esiste: senza, la risposta
# per utente inesistente è ~200ms più rapida (bcrypt saltato) e rivela quali
# username esistono
_DUMMY_HASH = hash_password("timing-equalizer-dummy")


class _RefreshRequest(BaseModel):
    token: str


@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    password_ok = verify_password(form_data.password, user.hashed_password if user else _DUMMY_HASH)
    if not user or not password_ok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")
    user.last_login = datetime.now(timezone.utc)
    db.commit()
    return {
        "access_token":  create_access_token({"sub": user.username}),
        "refresh_token": create_refresh_token({"sub": user.username}),
        "token_type":    "bearer",
    }


@router.post("/refresh")
def refresh_token(data: _RefreshRequest, db: Session = Depends(get_db)):
    """Refresh access token. Token must be sent in the request body (not URL params)."""
    payload = decode_token(data.token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    user = db.query(User).filter(User.username == payload.get("sub")).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user")
    return {"access_token": create_access_token({"sub": user.username}), "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

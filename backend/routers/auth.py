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
)
from middleware.auth import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


class _RefreshRequest(BaseModel):
    token: str


@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
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

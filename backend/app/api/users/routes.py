from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.core.security import hash_password, verify_password
from app.models import User
from app.schemas.auth import Message
from app.schemas.users import PasswordChange, UserRead, UserUpdate
from app.services.activity import log_activity
from app.services.users import normalize_email

router = APIRouter(prefix="/users", tags=["users"])


@router.patch("/me", response_model=UserRead)
def update_profile(
    payload: UserUpdate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> User:
    updates = payload.model_dump(exclude_unset=True)
    if updates.get("email") is not None:
        user.email = normalize_email(str(updates["email"]))
    if updates.get("name") is not None:
        user.name = updates["name"].strip()
    log_activity(
        session,
        action="user.profile_updated",
        user_id=user.id,
        entity_type="user",
        entity_id=user.id,
    )
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=409, detail="Email is already in use") from exc
    session.refresh(user)
    return user


@router.patch("/me/password", response_model=Message)
def update_password(
    payload: PasswordChange,
    response: Response,
    request: Request,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> Message:
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.password_hash = hash_password(payload.new_password)
    user.password_version += 1
    log_activity(
        session,
        action="user.password_changed",
        user_id=user.id,
        entity_type="user",
        entity_id=user.id,
    )
    session.commit()
    settings = request.app.state.settings
    response.delete_cookie(
        key=settings.cookie_name,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )
    return Message(message="Password changed. Please log in again.")

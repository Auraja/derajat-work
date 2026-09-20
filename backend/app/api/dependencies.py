import jwt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import User, Workspace, WorkspaceMember, WorkspaceRole

_WORKSPACE_WRITE_ROLES = {WorkspaceRole.owner, WorkspaceRole.admin}


def require_workspace_access(
    session: Session, workspace_id: int, user: User, *, write: bool = False
) -> WorkspaceMember:
    if session.get(Workspace, workspace_id) is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    membership = session.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user.id,
        )
    )
    if membership is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    if write and membership.role not in _WORKSPACE_WRITE_ROLES:
        raise HTTPException(status_code=403, detail="Workspace write access required")
    return membership


def require_global_admin(user: User) -> None:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Administrator access required")


def get_current_user(request: Request, session: Session = Depends(get_db)) -> User:
    settings = request.app.state.settings
    token = request.cookies.get(settings.cookie_name)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = jwt.decode(
            token,
            settings.secret_key.get_secret_value(),
            algorithms=["HS256"],
        )
        user_id = int(payload["sub"])
        token_version = int(payload["ver"])
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        ) from exc

    user = session.get(User, user_id)
    if user is None or user.password_version != token_version:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return user

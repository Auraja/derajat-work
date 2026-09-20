from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import User, Workspace, WorkspaceMember, WorkspaceRole
from app.services.seeding import seed_default_workspaces


def normalize_email(email: str) -> str:
    return email.strip().lower()


def provision_admin(session: Session, *, email: str, password: str, name: str) -> User:
    normalized_email = normalize_email(email)
    user = session.scalar(select(User).where(User.email == normalized_email))
    if user is None:
        user = User(
            email=normalized_email,
            password_hash=hash_password(password),
            name=name.strip(),
            is_admin=True,
        )
        session.add(user)
        session.flush()
    else:
        user.is_admin = True

    seed_default_workspaces(session)
    for workspace in session.scalars(select(Workspace)).all():
        membership = session.scalar(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace.id,
                WorkspaceMember.user_id == user.id,
            )
        )
        if membership is None:
            session.add(
                WorkspaceMember(
                    workspace_id=workspace.id, user_id=user.id, role=WorkspaceRole.owner
                )
            )
        else:
            membership.role = WorkspaceRole.owner
    session.commit()
    session.refresh(user)
    return user


def change_user_password(session: Session, user: User, password: str) -> None:
    user.password_hash = hash_password(password)
    user.password_version += 1
    session.commit()

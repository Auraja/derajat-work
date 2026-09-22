from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.encoders import jsonable_encoder
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_workspace_access
from app.core.database import get_db
from app.models import Module, TeachingSession, TeachingStatus, User, WorkspaceMember
from app.schemas.teaching import (
    TeachingSessionCreate,
    TeachingSessionImport,
    TeachingSessionPage,
    TeachingSessionRead,
    TeachingSessionUpdate,
)
from app.services.activity import log_activity

router = APIRouter(tags=["teaching"])


def _get_visible_session(session: Session, session_id: int, user_id: int) -> TeachingSession:
    teaching_session = session.scalar(
        select(TeachingSession)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == TeachingSession.workspace_id)
        .where(
            TeachingSession.id == session_id,
            TeachingSession.archived_at.is_(None),
            WorkspaceMember.user_id == user_id,
        )
    )
    if teaching_session is None:
        raise HTTPException(status_code=404, detail="Teaching session not found")
    return teaching_session


def _validate_module(session: Session, module_id: int | None, workspace_id: int) -> None:
    if (
        module_id is not None
        and session.scalar(
            select(Module.id).where(Module.id == module_id, Module.workspace_id == workspace_id)
        )
        is None
    ):
        raise HTTPException(status_code=422, detail="Module does not belong to workspace")


@router.get("/workspaces/{workspace_id}/teaching/sessions", response_model=TeachingSessionPage)
def list_teaching_sessions(
    workspace_id: int,
    search: str | None = None,
    status_filter: TeachingStatus | None = Query(default=None, alias="status"),
    sort: Literal["title", "scheduled_at", "created_at", "status"] = "scheduled_at",
    order: Literal["asc", "desc"] = "desc",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> TeachingSessionPage:
    require_workspace_access(session, workspace_id, user)
    filters = [
        TeachingSession.workspace_id == workspace_id,
        TeachingSession.archived_at.is_(None),
    ]
    if status_filter is not None:
        filters.append(TeachingSession.status == status_filter)
    if search:
        pattern = f"%{search.strip()}%"
        filters.append(
            or_(
                TeachingSession.title.ilike(pattern),
                TeachingSession.topic.ilike(pattern),
                TeachingSession.description.ilike(pattern),
                TeachingSession.instructor.ilike(pattern),
                cast(TeachingSession.instructors, String).ilike(pattern),
                TeachingSession.session_type.ilike(pattern),
                TeachingSession.location.ilike(pattern),
                TeachingSession.participant_label.ilike(pattern),
            )
        )
    total = session.scalar(select(func.count()).select_from(TeachingSession).where(*filters)) or 0
    sort_column = getattr(TeachingSession, sort)
    ordering = sort_column.asc() if order == "asc" else sort_column.desc()
    items = session.scalars(
        select(TeachingSession)
        .where(*filters)
        .order_by(ordering, TeachingSession.id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return TeachingSessionPage(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@router.post(
    "/workspaces/{workspace_id}/teaching/sessions",
    response_model=TeachingSessionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_teaching_session(
    workspace_id: int,
    payload: TeachingSessionCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> TeachingSession:
    require_workspace_access(session, workspace_id, user, write=True)
    _validate_module(session, payload.module_id, workspace_id)
    data = payload.model_dump()
    data["source"] = "manual"
    data["activities"] = jsonable_encoder(data["activities"])
    teaching_session = TeachingSession(
        workspace_id=workspace_id, created_by_id=user.id, **data
    )
    session.add(teaching_session)
    session.flush()
    log_activity(
        session,
        action="teaching_session.created",
        user_id=user.id,
        workspace_id=workspace_id,
        entity_type="teaching_session",
        entity_id=teaching_session.id,
    )
    session.commit()
    session.refresh(teaching_session)
    return teaching_session


@router.post(
    "/workspaces/{workspace_id}/teaching/sessions/import",
    response_model=list[TeachingSessionRead],
    status_code=status.HTTP_201_CREATED,
)
def import_teaching_sessions(
    workspace_id: int,
    payload: TeachingSessionImport,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> list[TeachingSession]:
    require_workspace_access(session, workspace_id, user, write=True)
    created: list[TeachingSession] = []
    for item in payload.sessions:
        _validate_module(session, item.module_id, workspace_id)
        data = item.model_dump()
        data["source"] = "external_ai"
        data["activities"] = jsonable_encoder(data["activities"])
        teaching_session = TeachingSession(
            workspace_id=workspace_id,
            created_by_id=user.id,
            **data,
        )
        session.add(teaching_session)
        session.flush()
        created.append(teaching_session)
        log_activity(
            session,
            action="teaching_session.imported",
            user_id=user.id,
            workspace_id=workspace_id,
            entity_type="teaching_session",
            entity_id=teaching_session.id,
        )
    session.commit()
    for item in created:
        session.refresh(item)
    return created


@router.get("/teaching/sessions/{session_id}", response_model=TeachingSessionRead)
def get_teaching_session(
    session_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> TeachingSession:
    return _get_visible_session(session, session_id, user.id)


@router.patch("/teaching/sessions/{session_id}", response_model=TeachingSessionRead)
def update_teaching_session(
    session_id: int,
    payload: TeachingSessionUpdate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> TeachingSession:
    teaching_session = _get_visible_session(session, session_id, user.id)
    require_workspace_access(session, teaching_session.workspace_id, user, write=True)
    updates = payload.model_dump(exclude_unset=True)
    _validate_module(session, updates.get("module_id"), teaching_session.workspace_id)
    if "activities" in updates:
        updates["activities"] = jsonable_encoder(updates["activities"])
    for field, value in updates.items():
        setattr(teaching_session, field, value)
    log_activity(
        session,
        action="teaching_session.updated",
        user_id=user.id,
        workspace_id=teaching_session.workspace_id,
        entity_type="teaching_session",
        entity_id=teaching_session.id,
    )
    session.commit()
    session.refresh(teaching_session)
    return teaching_session


@router.delete("/teaching/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_teaching_session(
    session_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> Response:
    teaching_session = _get_visible_session(session, session_id, user.id)
    require_workspace_access(session, teaching_session.workspace_id, user, write=True)
    teaching_session.status = TeachingStatus.archived
    teaching_session.archived_at = datetime.now(UTC)
    log_activity(
        session,
        action="teaching_session.archived",
        user_id=user.id,
        workspace_id=teaching_session.workspace_id,
        entity_type="teaching_session",
        entity_id=teaching_session.id,
    )
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

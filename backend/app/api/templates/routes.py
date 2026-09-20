from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_global_admin, require_workspace_access
from app.core.database import get_db
from app.models import Template, User, WorkspaceMember
from app.schemas.templates import TemplateCreate, TemplatePage, TemplateRead, TemplateUpdate
from app.services.activity import log_activity

router = APIRouter(prefix="/templates", tags=["templates"])
CurrentUser = Annotated[User, Depends(get_current_user)]
DatabaseSession = Annotated[Session, Depends(get_db)]


def _get_template(session: Session, template_id: int, user_id: int) -> Template:
    template = session.scalar(
        select(Template)
        .outerjoin(WorkspaceMember, WorkspaceMember.workspace_id == Template.workspace_id)
        .where(
            Template.id == template_id,
            or_(Template.workspace_id.is_(None), WorkspaceMember.user_id == user_id),
        )
    )
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.get("", response_model=TemplatePage)
def list_templates(
    user: CurrentUser,
    session: DatabaseSession,
    workspace_id: int | None = None,
    category: str | None = None,
    search: str | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> TemplatePage:
    filters = [or_(Template.workspace_id.is_(None), WorkspaceMember.user_id == user.id)]
    if workspace_id is not None:
        require_workspace_access(session, workspace_id, user)
        filters.append(or_(Template.workspace_id == workspace_id, Template.workspace_id.is_(None)))
    if category:
        filters.append(Template.category == category)
    if search:
        pattern = f"%{search.strip()}%"
        filters.append(or_(Template.name.ilike(pattern), Template.description.ilike(pattern)))
    visible = (
        select(Template.id)
        .outerjoin(WorkspaceMember, WorkspaceMember.workspace_id == Template.workspace_id)
        .where(*filters)
        .distinct()
        .subquery()
    )
    total = session.scalar(select(func.count()).select_from(visible)) or 0
    items = session.scalars(
        select(Template)
        .where(Template.id.in_(select(visible.c.id)))
        .order_by(Template.name.asc(), Template.id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return TemplatePage(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@router.post("", response_model=TemplateRead, status_code=status.HTTP_201_CREATED)
def create_template(
    payload: TemplateCreate, user: CurrentUser, session: DatabaseSession
) -> Template:
    if payload.workspace_id is not None:
        require_workspace_access(session, payload.workspace_id, user, write=True)
    else:
        require_global_admin(user)
    template = Template(created_by_id=user.id, **payload.model_dump())
    session.add(template)
    session.flush()
    log_activity(
        session,
        action="template.created",
        user_id=user.id,
        workspace_id=template.workspace_id,
        entity_type="template",
        entity_id=template.id,
    )
    session.commit()
    session.refresh(template)
    return template


@router.get("/{template_id}", response_model=TemplateRead)
def get_template(template_id: int, user: CurrentUser, session: DatabaseSession) -> Template:
    return _get_template(session, template_id, user.id)


@router.patch("/{template_id}", response_model=TemplateRead)
def update_template(
    template_id: int,
    payload: TemplateUpdate,
    user: CurrentUser,
    session: DatabaseSession,
) -> Template:
    template = _get_template(session, template_id, user.id)
    if template.workspace_id is None:
        require_global_admin(user)
    else:
        require_workspace_access(session, template.workspace_id, user, write=True)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(template, field, value)
    log_activity(
        session,
        action="template.updated",
        user_id=user.id,
        workspace_id=template.workspace_id,
        entity_type="template",
        entity_id=template.id,
    )
    session.commit()
    session.refresh(template)
    return template


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(template_id: int, user: CurrentUser, session: DatabaseSession) -> Response:
    template = _get_template(session, template_id, user.id)
    if template.workspace_id is None:
        require_global_admin(user)
    else:
        require_workspace_access(session, template.workspace_id, user, write=True)
    workspace_id = template.workspace_id
    entity_id = template.id
    session.delete(template)
    log_activity(
        session,
        action="template.deleted",
        user_id=user.id,
        workspace_id=workspace_id,
        entity_type="template",
        entity_id=entity_id,
    )
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

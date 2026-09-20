from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_workspace_access
from app.core.database import get_db
from app.models import Material, MaterialType, Module, TeachingSession, User, WorkspaceMember
from app.schemas.materials import MaterialCreate, MaterialPage, MaterialRead, MaterialUpdate
from app.services.activity import log_activity

router = APIRouter(prefix="/materials", tags=["materials"])


def _validate_module(session: Session, module_id: int | None, workspace_id: int) -> None:
    if (
        module_id is not None
        and session.scalar(
            select(Module.id).where(Module.id == module_id, Module.workspace_id == workspace_id)
        )
        is None
    ):
        raise HTTPException(status_code=422, detail="Module does not belong to workspace")


def _validate_teaching_session(
    session: Session, teaching_session_id: int | None, workspace_id: int
) -> None:
    if (
        teaching_session_id is not None
        and session.scalar(
            select(TeachingSession.id).where(
                TeachingSession.id == teaching_session_id,
                TeachingSession.workspace_id == workspace_id,
            )
        )
        is None
    ):
        raise HTTPException(status_code=422, detail="Teaching session does not belong to workspace")


def _get_material(session: Session, material_id: int, user_id: int) -> Material:
    material = session.scalar(
        select(Material)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Material.workspace_id)
        .where(Material.id == material_id, WorkspaceMember.user_id == user_id)
    )
    if material is None:
        raise HTTPException(status_code=404, detail="Material not found")
    return material


@router.get("", response_model=MaterialPage)
def list_materials(
    workspace_id: int,
    module_id: int | None = None,
    material_type: MaterialType | None = None,
    material_date: date | None = Query(default=None, alias="date"),
    date_from: date | None = None,
    date_to: date | None = None,
    search: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> MaterialPage:
    require_workspace_access(session, workspace_id, user)
    filters = [Material.workspace_id == workspace_id]
    if module_id is not None:
        filters.append(Material.module_id == module_id)
    if material_type is not None:
        filters.append(Material.material_type == material_type)
    if material_date is not None:
        filters.append(Material.material_date == material_date)
    if date_from is not None:
        filters.append(Material.material_date >= date_from)
    if date_to is not None:
        filters.append(Material.material_date <= date_to)
    if search:
        pattern = f"%{search.strip()}%"
        filters.append(or_(Material.title.ilike(pattern), Material.description.ilike(pattern)))
    total = session.scalar(select(func.count()).select_from(Material).where(*filters)) or 0
    items = session.scalars(
        select(Material)
        .where(*filters)
        .order_by(Material.material_date.desc(), Material.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return MaterialPage(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@router.post("", response_model=MaterialRead, status_code=status.HTTP_201_CREATED)
def create_material(
    payload: MaterialCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> Material:
    require_workspace_access(session, payload.workspace_id, user, write=True)
    _validate_module(session, payload.module_id, payload.workspace_id)
    _validate_teaching_session(session, payload.session_id, payload.workspace_id)
    values = payload.model_dump()
    if values["content_url"] is not None:
        values["content_url"] = str(values["content_url"])
    material = Material(created_by_id=user.id, **values)
    session.add(material)
    session.flush()
    log_activity(
        session,
        action="material.created",
        user_id=user.id,
        workspace_id=material.workspace_id,
        entity_type="material",
        entity_id=material.id,
    )
    session.commit()
    session.refresh(material)
    return material


@router.get("/{material_id}", response_model=MaterialRead)
def get_material(
    material_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> Material:
    return _get_material(session, material_id, user.id)


@router.patch("/{material_id}", response_model=MaterialRead)
def update_material(
    material_id: int,
    payload: MaterialUpdate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> Material:
    material = _get_material(session, material_id, user.id)
    require_workspace_access(session, material.workspace_id, user, write=True)
    updates = payload.model_dump(exclude_unset=True)
    _validate_module(session, updates.get("module_id"), material.workspace_id)
    _validate_teaching_session(session, updates.get("session_id"), material.workspace_id)
    if updates.get("content_url") is not None:
        updates["content_url"] = str(updates["content_url"])
    for field, value in updates.items():
        setattr(material, field, value)
    log_activity(
        session,
        action="material.updated",
        user_id=user.id,
        workspace_id=material.workspace_id,
        entity_type="material",
        entity_id=material.id,
    )
    session.commit()
    session.refresh(material)
    return material


@router.delete("/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_material(
    material_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> Response:
    material = _get_material(session, material_id, user.id)
    require_workspace_access(session, material.workspace_id, user, write=True)
    workspace_id = material.workspace_id
    entity_id = material.id
    session.delete(material)
    log_activity(
        session,
        action="material.deleted",
        user_id=user.id,
        workspace_id=workspace_id,
        entity_type="material",
        entity_id=entity_id,
    )
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

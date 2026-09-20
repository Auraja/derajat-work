from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.dependencies import get_current_user, require_workspace_access
from app.core.database import get_db
from app.models import (
    KanbanCard,
    Material,
    Module,
    TeachingSession,
    User,
    Workspace,
    WorkspaceMember,
    WorkspaceRole,
)
from app.schemas.workspaces import (
    ModuleCreate,
    ModuleRead,
    WorkspaceCreate,
    WorkspaceRead,
    WorkspaceUpdate,
)
from app.services.activity import log_activity
from app.utils.slug import slugify

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.post(
    "/{identifier}/modules", response_model=ModuleRead, status_code=status.HTTP_201_CREATED
)
def create_module(
    identifier: str,
    payload: ModuleCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> Module:
    workspace = _lookup_workspace(identifier, session)
    require_workspace_access(session, workspace.id, user, write=True)
    slug = payload.slug or slugify(payload.name)
    module = Module(
        workspace_id=workspace.id,
        name=payload.name,
        slug=slug,
        module_type=slug,
        description=payload.description,
    )
    session.add(module)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=409, detail="Modul dengan slug tersebut sudah ada") from exc
    session.refresh(module)
    return module


@router.delete("/{identifier}/modules/{module_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_module(
    identifier: str,
    module_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> Response:
    workspace = _lookup_workspace(identifier, session)
    require_workspace_access(session, workspace.id, user, write=True)
    module = session.scalar(
        select(Module).where(Module.id == module_id, Module.workspace_id == workspace.id)
    )
    if module is None:
        raise HTTPException(status_code=404, detail="Modul tidak ditemukan")
    has_projects = module.slug == "projects" and session.scalar(
        select(KanbanCard.id).where(KanbanCard.workspace_id == workspace.id).limit(1)
    ) is not None
    has_materials = session.scalar(
        select(Material.id).where(Material.module_id == module.id).limit(1)
    ) is not None
    has_sessions = session.scalar(
        select(TeachingSession.id).where(TeachingSession.module_id == module.id).limit(1)
    ) is not None
    if has_projects or has_materials or has_sessions:
        raise HTTPException(
            status_code=409, detail="Modul memiliki data terkait dan tidak dapat dihapus"
        )
    session.delete(module)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _serialize(workspace: Workspace, role: WorkspaceRole) -> WorkspaceRead:
    return WorkspaceRead(
        id=workspace.id,
        name=workspace.name,
        slug=workspace.slug,
        description=workspace.description,
        workspace_type=workspace.workspace_type,
        role=role,
        modules=workspace.modules,
        created_at=workspace.created_at,
        updated_at=workspace.updated_at,
    )


def _lookup_workspace(identifier: str, session: Session) -> Workspace:
    lookup = (
        Workspace.id == int(identifier) if identifier.isdigit() else Workspace.slug == identifier
    )
    workspace = session.scalar(
        select(Workspace).where(lookup).options(selectinload(Workspace.modules))
    )
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


def _role_for(workspace_id: int, user: User, session: Session) -> WorkspaceRole:
    membership = session.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user.id,
        )
    )
    if membership is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return membership.role


@router.get("", response_model=list[WorkspaceRead])
def list_workspaces(
    user: User = Depends(get_current_user), session: Session = Depends(get_db)
) -> list[WorkspaceRead]:
    rows = session.execute(
        select(Workspace, WorkspaceMember.role)
        .join(WorkspaceMember)
        .where(WorkspaceMember.user_id == user.id)
        .options(selectinload(Workspace.modules))
        .order_by(Workspace.id)
    ).all()
    return [_serialize(workspace, role) for workspace, role in rows]


@router.post("", response_model=WorkspaceRead, status_code=status.HTTP_201_CREATED)
def create_workspace(
    payload: WorkspaceCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> WorkspaceRead:
    workspace = Workspace(
        name=payload.name,
        slug=payload.slug or slugify(payload.name),
        description=payload.description,
        workspace_type=payload.workspace_type,
    )
    session.add(workspace)
    try:
        session.flush()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=409, detail="Workspace slug already exists") from exc
    session.add(
        WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role=WorkspaceRole.owner)
    )
    log_activity(
        session,
        action="workspace.created",
        user_id=user.id,
        workspace_id=workspace.id,
        entity_type="workspace",
        entity_id=workspace.id,
    )
    session.commit()
    workspace = _lookup_workspace(str(workspace.id), session)
    return _serialize(workspace, WorkspaceRole.owner)


@router.get("/{identifier}", response_model=WorkspaceRead)
def get_workspace(
    identifier: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> WorkspaceRead:
    workspace = _lookup_workspace(identifier, session)
    return _serialize(workspace, _role_for(workspace.id, user, session))


@router.patch("/{identifier}", response_model=WorkspaceRead)
def update_workspace(
    identifier: str,
    payload: WorkspaceUpdate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> WorkspaceRead:
    workspace = _lookup_workspace(identifier, session)
    membership = require_workspace_access(session, workspace.id, user, write=True)
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(workspace, field, value)
    log_activity(
        session,
        action="workspace.updated",
        user_id=user.id,
        workspace_id=workspace.id,
        entity_type="workspace",
        entity_id=workspace.id,
    )
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=409, detail="Workspace slug already exists") from exc
    workspace = _lookup_workspace(str(workspace.id), session)
    return _serialize(workspace, membership.role)


@router.delete("/{identifier}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workspace(
    identifier: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> Response:
    workspace = _lookup_workspace(identifier, session)
    membership = require_workspace_access(session, workspace.id, user, write=True)
    if membership.role != WorkspaceRole.owner:
        raise HTTPException(status_code=403, detail="Workspace owner access required")
    delegated_card = session.scalar(
        select(KanbanCard.id).where(KanbanCard.workspace_id == workspace.id).limit(1)
    )
    if delegated_card is not None:
        raise HTTPException(
            status_code=409,
            detail=(
                "Workspace memiliki kartu delegasi lintas workspace; "
                "pindahkan atau hapus kartu terlebih dahulu"
            ),
        )
    session.delete(workspace)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

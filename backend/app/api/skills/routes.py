from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.dependencies import get_current_user, require_workspace_access
from app.core.database import get_db
from app.models import Orchestration, OrchestrationStep, Skill, User, Workspace
from app.schemas.skills import (
    OrchestrationCreate,
    OrchestrationRead,
    OrchestrationStepRead,
    OrchestrationUpdate,
    SkillCreate,
    SkillRead,
    SkillUpdate,
)
from app.services.activity import log_activity
from app.utils.slug import slugify

router = APIRouter(tags=["skills"])


def _workspace(identifier: str, session: Session) -> Workspace:
    lookup = (
        Workspace.id == int(identifier) if identifier.isdigit() else Workspace.slug == identifier
    )
    workspace = session.scalar(select(Workspace).where(lookup))
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


def _skill(skill_id: int, session: Session) -> Skill:
    skill = session.get(Skill, skill_id)
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")
    return skill


def _orchestration(orchestration_id: int, session: Session) -> Orchestration:
    orchestration = session.scalar(
        select(Orchestration)
        .where(Orchestration.id == orchestration_id)
        .options(selectinload(Orchestration.steps).selectinload(OrchestrationStep.skill))
    )
    if orchestration is None:
        raise HTTPException(status_code=404, detail="Orchestration not found")
    return orchestration


def _serialize_orchestration(orchestration: Orchestration) -> OrchestrationRead:
    return OrchestrationRead(
        id=orchestration.id,
        workspace_id=orchestration.workspace_id,
        name=orchestration.name,
        description=orchestration.description,
        steps=[
            OrchestrationStepRead(
                position=step.position, skill=SkillRead.model_validate(step.skill)
            )
            for step in sorted(orchestration.steps, key=lambda item: item.position)
        ],
        created_at=orchestration.created_at,
        updated_at=orchestration.updated_at,
    )


def _replace_steps(orchestration: Orchestration, skill_ids: list[int], session: Session) -> None:
    skills = session.scalars(
        select(Skill).where(
            Skill.workspace_id == orchestration.workspace_id,
            Skill.id.in_(skill_ids),
        )
    ).all()
    by_id = {skill.id: skill for skill in skills}
    if len(by_id) != len(skill_ids):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Every skill must belong to this workspace",
        )
    orchestration.steps.clear()
    session.flush()
    orchestration.steps.extend(
        OrchestrationStep(skill=by_id[skill_id], position=position)
        for position, skill_id in enumerate(skill_ids)
    )


@router.get("/workspaces/{identifier}/skills", response_model=list[SkillRead])
def list_skills(
    identifier: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> list[Skill]:
    workspace = _workspace(identifier, session)
    require_workspace_access(session, workspace.id, user)
    return list(
        session.scalars(
            select(Skill).where(Skill.workspace_id == workspace.id).order_by(Skill.id)
        ).all()
    )


@router.post(
    "/workspaces/{identifier}/skills",
    response_model=SkillRead,
    status_code=status.HTTP_201_CREATED,
)
def create_skill(
    identifier: str,
    payload: SkillCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> Skill:
    workspace = _workspace(identifier, session)
    require_workspace_access(session, workspace.id, user, write=True)
    skill = Skill(
        workspace_id=workspace.id,
        created_by_id=user.id,
        name=payload.name,
        slug=payload.slug or slugify(payload.name),
        description=payload.description,
        instructions=payload.instructions,
        is_enabled=payload.is_enabled,
    )
    session.add(skill)
    log_activity(
        session,
        action="skill.created",
        user_id=user.id,
        workspace_id=workspace.id,
        entity_type="skill",
    )
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=409, detail="Skill slug already exists") from exc
    session.refresh(skill)
    return skill


@router.get("/skills/{skill_id}", response_model=SkillRead)
def get_skill(
    skill_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> Skill:
    skill = _skill(skill_id, session)
    require_workspace_access(session, skill.workspace_id, user)
    return skill


@router.patch("/skills/{skill_id}", response_model=SkillRead)
def update_skill(
    skill_id: int,
    payload: SkillUpdate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> Skill:
    skill = _skill(skill_id, session)
    require_workspace_access(session, skill.workspace_id, user, write=True)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(skill, field, value)
    log_activity(
        session,
        action="skill.updated",
        user_id=user.id,
        workspace_id=skill.workspace_id,
        entity_type="skill",
        entity_id=skill.id,
    )
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=409, detail="Skill slug already exists") from exc
    session.refresh(skill)
    return skill


@router.delete("/skills/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_skill(
    skill_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> Response:
    skill = _skill(skill_id, session)
    require_workspace_access(session, skill.workspace_id, user, write=True)
    if (
        session.scalar(
            select(OrchestrationStep.id).where(OrchestrationStep.skill_id == skill.id).limit(1)
        )
        is not None
    ):
        raise HTTPException(status_code=409, detail="Skill is used by an orchestration")
    session.delete(skill)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/workspaces/{identifier}/orchestrations", response_model=list[OrchestrationRead])
def list_orchestrations(
    identifier: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> list[OrchestrationRead]:
    workspace = _workspace(identifier, session)
    require_workspace_access(session, workspace.id, user)
    rows = session.scalars(
        select(Orchestration)
        .where(Orchestration.workspace_id == workspace.id)
        .options(selectinload(Orchestration.steps).selectinload(OrchestrationStep.skill))
        .order_by(Orchestration.id)
    ).all()
    return [_serialize_orchestration(item) for item in rows]


@router.post(
    "/workspaces/{identifier}/orchestrations",
    response_model=OrchestrationRead,
    status_code=status.HTTP_201_CREATED,
)
def create_orchestration(
    identifier: str,
    payload: OrchestrationCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> OrchestrationRead:
    workspace = _workspace(identifier, session)
    require_workspace_access(session, workspace.id, user, write=True)
    orchestration = Orchestration(
        workspace_id=workspace.id,
        created_by_id=user.id,
        name=payload.name,
        description=payload.description,
    )
    session.add(orchestration)
    session.flush()
    _replace_steps(orchestration, payload.skill_ids, session)
    log_activity(
        session,
        action="orchestration.created",
        user_id=user.id,
        workspace_id=workspace.id,
        entity_type="orchestration",
        entity_id=orchestration.id,
    )
    session.commit()
    return _serialize_orchestration(_orchestration(orchestration.id, session))


@router.get("/orchestrations/{orchestration_id}", response_model=OrchestrationRead)
def get_orchestration(
    orchestration_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> OrchestrationRead:
    orchestration = _orchestration(orchestration_id, session)
    require_workspace_access(session, orchestration.workspace_id, user)
    return _serialize_orchestration(orchestration)


@router.patch("/orchestrations/{orchestration_id}", response_model=OrchestrationRead)
def update_orchestration(
    orchestration_id: int,
    payload: OrchestrationUpdate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> OrchestrationRead:
    orchestration = _orchestration(orchestration_id, session)
    require_workspace_access(session, orchestration.workspace_id, user, write=True)
    updates = payload.model_dump(exclude_unset=True)
    skill_ids = updates.pop("skill_ids", None)
    for field, value in updates.items():
        setattr(orchestration, field, value)
    if skill_ids is not None:
        _replace_steps(orchestration, skill_ids, session)
    log_activity(
        session,
        action="orchestration.updated",
        user_id=user.id,
        workspace_id=orchestration.workspace_id,
        entity_type="orchestration",
        entity_id=orchestration.id,
    )
    session.commit()
    return _serialize_orchestration(_orchestration(orchestration.id, session))


@router.delete("/orchestrations/{orchestration_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_orchestration(
    orchestration_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> Response:
    orchestration = _orchestration(orchestration_id, session)
    require_workspace_access(session, orchestration.workspace_id, user, write=True)
    session.delete(orchestration)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

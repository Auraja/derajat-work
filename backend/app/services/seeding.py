from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ApplicationState, Module, Workspace, WorkspaceType

_SEED_KEY = "default_workspaces_v1"

_DEFAULTS = (
    (
        "PT BISA AI",
        "bisa-ai",
        WorkspaceType.company,
        ("Teaching", "Projects", "Files"),
    ),
    (
        "PT Solusi Kecerdasan Buatan",
        "solusi-kecerdasan-buatan",
        WorkspaceType.company,
        ("Projects", "Clients", "Documents"),
    ),
    ("Personal", "personal", WorkspaceType.personal, ("Research", "Notes", "Projects")),
)


def _slugify(name: str) -> str:
    return name.lower().replace(" ", "-")


def seed_default_workspaces(session: Session) -> list[Workspace]:
    existing_workspaces = list(session.scalars(select(Workspace).order_by(Workspace.id)).all())
    if session.get(ApplicationState, _SEED_KEY) is not None:
        return existing_workspaces
    if existing_workspaces:
        session.add(ApplicationState(key=_SEED_KEY, value="complete"))
        session.commit()
        return existing_workspaces

    seeded: list[Workspace] = []
    for name, slug, workspace_type, module_names in _DEFAULTS:
        workspace = session.scalar(select(Workspace).where(Workspace.slug == slug))
        if workspace is None:
            workspace = Workspace(name=name, slug=slug, workspace_type=workspace_type)
            session.add(workspace)
            session.flush()
        for module_name in module_names:
            module_slug = _slugify(module_name)
            existing = session.scalar(
                select(Module).where(
                    Module.workspace_id == workspace.id,
                    Module.slug == module_slug,
                )
            )
            if existing is None:
                session.add(Module(workspace_id=workspace.id, name=module_name, slug=module_slug))
        seeded.append(workspace)
    session.add(ApplicationState(key=_SEED_KEY, value="complete"))
    session.commit()
    return seeded

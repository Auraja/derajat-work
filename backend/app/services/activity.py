from sqlalchemy.orm import Session

from app.models import ActivityLog


def log_activity(
    session: Session,
    *,
    action: str,
    user_id: int | None = None,
    workspace_id: int | None = None,
    entity_type: str | None = None,
    entity_id: int | str | None = None,
    details: dict[str, object] | None = None,
) -> None:
    session.add(
        ActivityLog(
            action=action,
            user_id=user_id,
            workspace_id=workspace_id,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            metadata_json=details,
        )
    )

from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.workspace import Workspace


class ActivityLog(TimestampMixin, Base):
    __tablename__ = "activity_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    workspace_id: Mapped[int | None] = mapped_column(
        ForeignKey("workspaces.id", ondelete="SET NULL"), index=True
    )
    action: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    entity_type: Mapped[str | None] = mapped_column(String(80))
    entity_id: Mapped[str | None] = mapped_column(String(80))
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column(JSON)

    user: Mapped["User | None"] = relationship(back_populates="activity_logs")
    workspace: Mapped["Workspace | None"] = relationship(back_populates="activity_logs")

import enum
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Date, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.module import Module
    from app.models.user import User
    from app.models.workspace import Workspace


class TeachingStatus(enum.StrEnum):
    draft = "draft"
    preparing = "preparing"
    ready = "ready"
    scheduled = "scheduled"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"
    archived = "archived"


class TeachingSession(TimestampMixin, Base):
    __tablename__ = "teaching_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True, nullable=False
    )
    module_id: Mapped[int | None] = mapped_column(
        ForeignKey("modules.id", ondelete="SET NULL"), index=True
    )
    created_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(240), index=True, nullable=False)
    topic: Mapped[str | None] = mapped_column(String(240), index=True)
    description: Mapped[str | None] = mapped_column(Text)
    audience: Mapped[str | None] = mapped_column(String(240))
    location: Mapped[str | None] = mapped_column(String(240))
    participant_count: Mapped[int | None] = mapped_column(Integer)
    participant_label: Mapped[str | None] = mapped_column(String(240))
    source: Mapped[str] = mapped_column(
        String(30), default="manual", server_default="manual", nullable=False
    )
    difficulty: Mapped[str | None] = mapped_column(String(40), index=True)
    instructor: Mapped[str | None] = mapped_column(String(200))
    instructors: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    activities: Mapped[list[dict[str, str]]] = mapped_column(JSON, default=list, nullable=False)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    duration_minutes: Mapped[int | None] = mapped_column(Integer)
    session_type: Mapped[str | None] = mapped_column(String(80), index=True)
    session_date: Mapped[date | None] = mapped_column(Date, index=True)
    status: Mapped[TeachingStatus] = mapped_column(
        Enum(TeachingStatus, native_enum=False),
        default=TeachingStatus.draft,
        index=True,
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(Text)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)

    workspace: Mapped["Workspace"] = relationship(back_populates="teaching_sessions")
    module: Mapped["Module | None"] = relationship()
    created_by: Mapped["User"] = relationship()

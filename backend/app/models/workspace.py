import enum
from typing import TYPE_CHECKING

from sqlalchemy import Enum, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.activity_log import ActivityLog
    from app.models.generated_file import GeneratedFile
    from app.models.kanban import KanbanColumn
    from app.models.material import Material
    from app.models.module import Module
    from app.models.orchestration import Orchestration
    from app.models.skill import Skill
    from app.models.teaching_session import TeachingSession
    from app.models.template import Template
    from app.models.workspace_member import WorkspaceMember


class WorkspaceType(enum.StrEnum):
    company = "company"
    organization = "organization"
    personal = "personal"


class Workspace(TimestampMixin, Base):
    __tablename__ = "workspaces"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    workspace_type: Mapped[WorkspaceType] = mapped_column(
        Enum(WorkspaceType, native_enum=False), nullable=False
    )

    modules: Mapped[list["Module"]] = relationship(
        back_populates="workspace", cascade="all, delete-orphan", order_by="Module.id"
    )
    kanban_columns: Mapped[list["KanbanColumn"]] = relationship(
        back_populates="workspace", cascade="all, delete-orphan"
    )
    members: Mapped[list["WorkspaceMember"]] = relationship(
        back_populates="workspace", cascade="all, delete-orphan"
    )
    activity_logs: Mapped[list["ActivityLog"]] = relationship(back_populates="workspace")
    teaching_sessions: Mapped[list["TeachingSession"]] = relationship(
        back_populates="workspace", cascade="all, delete-orphan"
    )
    materials: Mapped[list["Material"]] = relationship(
        back_populates="workspace", cascade="all, delete-orphan"
    )
    templates: Mapped[list["Template"]] = relationship(
        back_populates="workspace", cascade="all, delete-orphan"
    )
    generated_files: Mapped[list["GeneratedFile"]] = relationship(
        back_populates="workspace", cascade="all, delete-orphan"
    )
    skills: Mapped[list["Skill"]] = relationship(
        back_populates="workspace", cascade="all, delete-orphan"
    )
    orchestrations: Mapped[list["Orchestration"]] = relationship(
        back_populates="workspace", cascade="all, delete-orphan"
    )

import enum
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Date, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.generated_file import GeneratedFile
    from app.models.module import Module
    from app.models.teaching_session import TeachingSession
    from app.models.user import User
    from app.models.workspace import Workspace


class MaterialType(enum.StrEnum):
    document = "document"
    presentation = "presentation"
    video = "video"
    audio = "audio"
    image = "image"
    link = "link"
    spreadsheet = "spreadsheet"
    code = "code"
    archive = "archive"
    other = "other"


class Material(TimestampMixin, Base):
    __tablename__ = "materials"

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True, nullable=False
    )
    module_id: Mapped[int | None] = mapped_column(
        ForeignKey("modules.id", ondelete="SET NULL"), index=True
    )
    session_id: Mapped[int | None] = mapped_column(
        ForeignKey("teaching_sessions.id", ondelete="SET NULL"), index=True
    )
    created_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(240), index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    material_type: Mapped[MaterialType] = mapped_column(
        Enum(MaterialType, native_enum=False), index=True, nullable=False
    )
    status: Mapped[str] = mapped_column(String(40), default="draft", index=True, nullable=False)
    material_date: Mapped[date | None] = mapped_column(Date, index=True)
    content_url: Mapped[str | None] = mapped_column(String(2048))
    content: Mapped[str | None] = mapped_column(Text)
    file_path: Mapped[str | None] = mapped_column(String(2048))
    metadata_json: Mapped[dict[str, object] | None] = mapped_column(JSON)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)

    workspace: Mapped["Workspace"] = relationship(back_populates="materials")
    module: Mapped["Module | None"] = relationship()
    teaching_session: Mapped["TeachingSession | None"] = relationship()
    created_by: Mapped["User"] = relationship()
    generated_files: Mapped[list["GeneratedFile"]] = relationship(back_populates="material")

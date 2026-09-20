from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.workspace import Workspace


class Template(TimestampMixin, Base):
    __tablename__ = "templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int | None] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    created_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    template_type: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    category: Mapped[str | None] = mapped_column(String(120), index=True)
    config_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    workspace: Mapped["Workspace | None"] = relationship(back_populates="templates")
    created_by: Mapped["User"] = relationship()

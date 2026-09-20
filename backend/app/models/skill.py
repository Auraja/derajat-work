from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.orchestration_step import OrchestrationStep
    from app.models.user import User
    from app.models.workspace import Workspace


class Skill(TimestampMixin, Base):
    __tablename__ = "skills"
    __table_args__ = (UniqueConstraint("workspace_id", "slug"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True, nullable=False
    )
    created_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    instructions: Mapped[str] = mapped_column(Text, nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    workspace: Mapped["Workspace"] = relationship(back_populates="skills")
    created_by: Mapped["User"] = relationship()
    orchestration_steps: Mapped[list["OrchestrationStep"]] = relationship(
        back_populates="skill", passive_deletes=True
    )

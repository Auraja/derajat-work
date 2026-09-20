from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.orchestration_step import OrchestrationStep
    from app.models.user import User
    from app.models.workspace import Workspace


class Orchestration(TimestampMixin, Base):
    __tablename__ = "orchestrations"

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True, nullable=False
    )
    created_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    workspace: Mapped["Workspace"] = relationship(back_populates="orchestrations")
    created_by: Mapped["User"] = relationship()
    steps: Mapped[list["OrchestrationStep"]] = relationship(
        back_populates="orchestration",
        cascade="all, delete-orphan",
        order_by="OrchestrationStep.position",
    )

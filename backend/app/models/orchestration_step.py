from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.orchestration import Orchestration
    from app.models.skill import Skill


class OrchestrationStep(TimestampMixin, Base):
    __tablename__ = "orchestration_steps"
    __table_args__ = (
        UniqueConstraint(
            "orchestration_id",
            "position",
            name="uq_orchestration_steps_orchestration_position",
        ),
        UniqueConstraint(
            "orchestration_id",
            "skill_id",
            name="uq_orchestration_steps_orchestration_skill",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    orchestration_id: Mapped[int] = mapped_column(
        ForeignKey("orchestrations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    skill_id: Mapped[int] = mapped_column(
        ForeignKey("skills.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    position: Mapped[int] = mapped_column(nullable=False)

    orchestration: Mapped["Orchestration"] = relationship(back_populates="steps")
    skill: Mapped["Skill"] = relationship(back_populates="orchestration_steps")

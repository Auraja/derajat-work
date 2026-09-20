from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.material import Material
    from app.models.workspace import Workspace


class GeneratedFile(TimestampMixin, Base):
    __tablename__ = "generated_files"

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True, nullable=False
    )
    material_id: Mapped[int | None] = mapped_column(
        ForeignKey("materials.id", ondelete="SET NULL"), index=True
    )
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    file_path: Mapped[str] = mapped_column(String(2048), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)

    workspace: Mapped["Workspace"] = relationship(back_populates="generated_files")
    material: Mapped["Material | None"] = relationship(back_populates="generated_files")

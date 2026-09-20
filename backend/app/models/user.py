from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.activity_log import ActivityLog
    from app.models.workspace_member import WorkspaceMember


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    password_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    memberships: Mapped[list["WorkspaceMember"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    activity_logs: Mapped[list["ActivityLog"]] = relationship(back_populates="user")

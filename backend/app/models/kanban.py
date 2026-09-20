import enum
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.workspace import Workspace


class CardPriority(enum.StrEnum):
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"


class KanbanColumn(TimestampMixin, Base):
    __tablename__ = "kanban_columns"
    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int | None] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True, nullable=True
    )
    status_key: Mapped[str | None] = mapped_column(String(32), unique=True, nullable=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    workspace: Mapped["Workspace | None"] = relationship(back_populates="kanban_columns")
    cards: Mapped[list["KanbanCard"]] = relationship(
        back_populates="column", cascade="all, delete-orphan", order_by="KanbanCard.position"
    )


class KanbanCard(TimestampMixin, Base):
    __tablename__ = "kanban_cards"
    __table_args__ = (
        UniqueConstraint("column_id", "position", name="uq_kanban_cards_column_position"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    column_id: Mapped[int] = mapped_column(
        ForeignKey("kanban_columns.id", ondelete="CASCADE"), index=True
    )
    workspace_id: Mapped[int] = mapped_column(
        ForeignKey("workspaces.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(240), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    assignee: Mapped[str | None] = mapped_column(String(160))
    priority: Mapped[CardPriority] = mapped_column(
        Enum(CardPriority, native_enum=False, length=16),
        default=CardPriority.medium,
        nullable=False,
    )
    due_date: Mapped[date | None]
    start_date: Mapped[date | None]
    labels: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    column: Mapped[KanbanColumn] = relationship(back_populates="cards")
    checklist_items: Mapped[list["KanbanChecklistItem"]] = relationship(
        back_populates="card", cascade="all, delete-orphan", order_by="KanbanChecklistItem.position"
    )
    attachments: Mapped[list["KanbanAttachment"]] = relationship(
        back_populates="card", cascade="all, delete-orphan", order_by="KanbanAttachment.created_at"
    )
    comments: Mapped[list["KanbanComment"]] = relationship(
        back_populates="card", cascade="all, delete-orphan", order_by="KanbanComment.created_at"
    )
    activities: Mapped[list["KanbanActivity"]] = relationship(
        back_populates="card", cascade="all, delete-orphan", order_by="KanbanActivity.created_at"
    )

    @property
    def checklist_total(self) -> int:
        return len(self.checklist_items)

    @property
    def checklist_completed(self) -> int:
        return sum(item.is_completed for item in self.checklist_items)


class KanbanChecklistItem(TimestampMixin, Base):
    __tablename__ = "kanban_checklist_items"
    __table_args__ = (
        UniqueConstraint("card_id", "position", name="uq_kanban_checklist_card_position"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    card_id: Mapped[int] = mapped_column(
        ForeignKey("kanban_cards.id", ondelete="CASCADE"), index=True
    )
    text: Mapped[str] = mapped_column(String(500), nullable=False)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    card: Mapped[KanbanCard] = relationship(back_populates="checklist_items")


class KanbanAttachment(TimestampMixin, Base):
    __tablename__ = "kanban_attachments"
    id: Mapped[int] = mapped_column(primary_key=True)
    card_id: Mapped[int] = mapped_column(
        ForeignKey("kanban_cards.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(240), nullable=False)
    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    card: Mapped[KanbanCard] = relationship(back_populates="attachments")


class KanbanComment(TimestampMixin, Base):
    __tablename__ = "kanban_comments"
    id: Mapped[int] = mapped_column(primary_key=True)
    card_id: Mapped[int] = mapped_column(
        ForeignKey("kanban_cards.id", ondelete="CASCADE"), index=True
    )
    author: Mapped[str] = mapped_column(String(160), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    card: Mapped[KanbanCard] = relationship(back_populates="comments")


class KanbanActivity(TimestampMixin, Base):
    __tablename__ = "kanban_activities"
    id: Mapped[int] = mapped_column(primary_key=True)
    card_id: Mapped[int] = mapped_column(
        ForeignKey("kanban_cards.id", ondelete="CASCADE"), index=True
    )
    actor: Mapped[str] = mapped_column(String(160), nullable=False)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    detail: Mapped[str] = mapped_column(Text, nullable=False)
    card: Mapped[KanbanCard] = relationship(back_populates="activities")

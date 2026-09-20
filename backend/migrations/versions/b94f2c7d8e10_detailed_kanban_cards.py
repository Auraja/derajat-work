"""add detailed kanban cards

Revision ID: b94f2c7d8e10
Revises: 8a21c4d5e6f7
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b94f2c7d8e10"
down_revision: str | None = "8a21c4d5e6f7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def timestamps() -> list[sa.Column]:
    return [
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    ]


def upgrade() -> None:
    with op.batch_alter_table("kanban_cards") as batch_op:
        batch_op.add_column(sa.Column("assignee", sa.String(length=160), nullable=True))
        batch_op.add_column(
            sa.Column("priority", sa.String(length=16), server_default="medium", nullable=False)
        )
        batch_op.add_column(sa.Column("due_date", sa.Date(), nullable=True))
        batch_op.add_column(sa.Column("start_date", sa.Date(), nullable=True))
        batch_op.add_column(sa.Column("labels", sa.JSON(), server_default="[]", nullable=False))

    op.create_table(
        "kanban_checklist_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "card_id",
            sa.Integer(),
            sa.ForeignKey("kanban_cards.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("text", sa.String(length=500), nullable=False),
        sa.Column("is_completed", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        *timestamps(),
        sa.UniqueConstraint("card_id", "position", name="uq_kanban_checklist_card_position"),
    )
    op.create_index("ix_kanban_checklist_items_card_id", "kanban_checklist_items", ["card_id"])
    for name, columns in (
        (
            "kanban_attachments",
            [
                sa.Column("title", sa.String(240), nullable=False),
                sa.Column("url", sa.String(2048), nullable=False),
            ],
        ),
        (
            "kanban_comments",
            [
                sa.Column("author", sa.String(160), nullable=False),
                sa.Column("body", sa.Text(), nullable=False),
            ],
        ),
        (
            "kanban_activities",
            [
                sa.Column("actor", sa.String(160), nullable=False),
                sa.Column("action", sa.String(64), nullable=False),
                sa.Column("detail", sa.Text(), nullable=False),
            ],
        ),
    ):
        op.create_table(
            name,
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "card_id",
                sa.Integer(),
                sa.ForeignKey("kanban_cards.id", ondelete="CASCADE"),
                nullable=False,
            ),
            *columns,
            *timestamps(),
        )
        op.create_index(f"ix_{name}_card_id", name, ["card_id"])

    bind = op.get_bind()
    bind.execute(
        sa.text(
            "INSERT INTO kanban_activities "
            "(card_id, actor, action, detail, created_at, updated_at) "
            "SELECT id, 'Sistem', 'created', "
            "'Kartu tersedia sebelum riwayat diaktifkan', created_at, updated_at "
            "FROM kanban_cards"
        )
    )


def downgrade() -> None:
    for name in (
        "kanban_activities",
        "kanban_comments",
        "kanban_attachments",
        "kanban_checklist_items",
    ):
        op.drop_index(f"ix_{name}_card_id", table_name=name)
        op.drop_table(name)
    with op.batch_alter_table("kanban_cards") as batch_op:
        batch_op.drop_column("labels")
        batch_op.drop_column("start_date")
        batch_op.drop_column("due_date")
        batch_op.drop_column("priority")
        batch_op.drop_column("assignee")

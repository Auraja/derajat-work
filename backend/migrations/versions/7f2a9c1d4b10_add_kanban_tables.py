"""add kanban tables

Revision ID: 7f2a9c1d4b10
Revises: e188bd7fe19b
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "7f2a9c1d4b10"
down_revision: str | None = "e188bd7fe19b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "kanban_columns",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("workspace_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_kanban_columns_workspace_id"), "kanban_columns", ["workspace_id"])
    op.create_table(
        "kanban_cards",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("column_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=240), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["column_id"], ["kanban_columns.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_kanban_cards_column_id"), "kanban_cards", ["column_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_kanban_cards_column_id"), table_name="kanban_cards")
    op.drop_table("kanban_cards")
    op.drop_index(op.f("ix_kanban_columns_workspace_id"), table_name="kanban_columns")
    op.drop_table("kanban_columns")

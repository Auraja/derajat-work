"""archive completed kanban cards

Revision ID: c41d6e8f2a30
Revises: b94f2c7d8e10
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c41d6e8f2a30"
down_revision: str | None = "b94f2c7d8e10"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("kanban_cards") as batch_op:
        batch_op.add_column(sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.create_index("ix_kanban_cards_archived_at", ["archived_at"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("kanban_cards") as batch_op:
        batch_op.drop_index("ix_kanban_cards_archived_at")
        batch_op.drop_column("archived_at")

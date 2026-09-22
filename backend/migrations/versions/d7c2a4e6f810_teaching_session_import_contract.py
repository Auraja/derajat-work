"""add teaching session import contract fields"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d7c2a4e6f810"
down_revision: str | None = "9f3a7c1e5b20"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("teaching_sessions") as batch_op:
        batch_op.add_column(sa.Column("location", sa.String(length=240), nullable=True))
        batch_op.add_column(sa.Column("participant_count", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("participant_label", sa.String(length=240), nullable=True))
        batch_op.add_column(
            sa.Column("source", sa.String(length=30), server_default="manual", nullable=False)
        )


def downgrade() -> None:
    with op.batch_alter_table("teaching_sessions") as batch_op:
        batch_op.drop_column("source")
        batch_op.drop_column("participant_label")
        batch_op.drop_column("participant_count")
        batch_op.drop_column("location")

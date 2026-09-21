"""add structured teaching schedule fields"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "9f3a7c1e5b20"
down_revision: str | None = "c41d6e8f2a30"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("teaching_sessions") as batch_op:
        batch_op.add_column(sa.Column("instructors", sa.JSON(), nullable=False, server_default="[]"))
        batch_op.add_column(sa.Column("activities", sa.JSON(), nullable=False, server_default="[]"))


def downgrade() -> None:
    with op.batch_alter_table("teaching_sessions") as batch_op:
        batch_op.drop_column("activities")
        batch_op.drop_column("instructors")
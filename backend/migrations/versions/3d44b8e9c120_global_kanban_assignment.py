"""add global kanban card assignment

Revision ID: 3d44b8e9c120
Revises: 7f2a9c1d4b10

Existing cards are assigned to the workspace that owns their status column.  The
column remains workspace-owned as a shared status definition; the global board
may show every definition visible to the user while card assignment can move
independently between writable workspaces.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "3d44b8e9c120"
down_revision: str | None = "7f2a9c1d4b10"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # The deployed predecessor gave two unique constraints the same generated
    # name. Repair that live schema before adding the new Kanban assignment.
    with op.batch_alter_table("orchestration_steps") as batch_op:
        batch_op.drop_constraint("uq_orchestration_steps_orchestration_id", type_="unique")
        batch_op.create_unique_constraint(
            "uq_orchestration_steps_orchestration_position",
            ["orchestration_id", "position"],
        )
        batch_op.create_unique_constraint(
            "uq_orchestration_steps_orchestration_skill",
            ["orchestration_id", "skill_id"],
        )
    with op.batch_alter_table("kanban_cards") as batch_op:
        batch_op.add_column(sa.Column("workspace_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_kanban_cards_workspace_id",
            "workspaces",
            ["workspace_id"],
            ["id"],
            ondelete="RESTRICT",
        )
        batch_op.create_index("ix_kanban_cards_workspace_id", ["workspace_id"])
    op.execute(
        "UPDATE kanban_cards SET workspace_id = "
        "(SELECT workspace_id FROM kanban_columns WHERE kanban_columns.id = kanban_cards.column_id)"
    )
    op.execute(
        "WITH ranked AS ("
        "SELECT id, ROW_NUMBER() OVER "
        "(PARTITION BY column_id ORDER BY position, id) - 1 AS new_position "
        "FROM kanban_cards"
        ") UPDATE kanban_cards SET position = "
        "(SELECT new_position FROM ranked WHERE ranked.id = kanban_cards.id)"
    )
    with op.batch_alter_table("kanban_cards") as batch_op:
        batch_op.alter_column("workspace_id", existing_type=sa.Integer(), nullable=False)
        batch_op.create_unique_constraint(
            "uq_kanban_cards_column_position", ["column_id", "position"]
        )


def downgrade() -> None:
    with op.batch_alter_table("kanban_cards") as batch_op:
        batch_op.drop_constraint("uq_kanban_cards_column_position", type_="unique")
        batch_op.drop_index("ix_kanban_cards_workspace_id")
        batch_op.drop_constraint("fk_kanban_cards_workspace_id", type_="foreignkey")
        batch_op.drop_column("workspace_id")
    with op.batch_alter_table("orchestration_steps") as batch_op:
        batch_op.drop_constraint(
            "uq_orchestration_steps_orchestration_skill", type_="unique"
        )
        batch_op.drop_constraint(
            "uq_orchestration_steps_orchestration_position", type_="unique"
        )
        batch_op.create_unique_constraint(
            "uq_orchestration_steps_orchestration_id",
            ["orchestration_id", "position"],
        )

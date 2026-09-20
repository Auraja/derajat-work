"""replace workspace columns with canonical global statuses

Revision ID: 8a21c4d5e6f7
Revises: 3d44b8e9c120
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "8a21c4d5e6f7"
down_revision: str | None = "3d44b8e9c120"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

STATUSES = ("Backlog", "To Do", "In Progress", "Review", "Done")


def status_for(title: str) -> str:
    value = " ".join(title.casefold().replace("_", " ").replace("-", " ").split())
    if value in {"to do", "todo", "masuk", "akan dikerjakan", "daftar tugas", "rencana"}:
        return "To Do"
    if value in {"in progress", "doing", "dikerjakan", "sedang dikerjakan", "proses"}:
        return "In Progress"
    if value in {"review", "qa", "quality assurance", "ditinjau", "peninjauan"}:
        return "Review"
    if value in {"done", "selesai", "completed", "complete", "rampung"}:
        return "Done"
    if value in {"backlog", "icebox", "ide", "ideas"}:
        return "Backlog"
    return "Backlog"


def upgrade() -> None:
    bind = op.get_bind()
    with op.batch_alter_table("kanban_columns") as batch_op:
        batch_op.alter_column("workspace_id", existing_type=sa.Integer(), nullable=True)
        batch_op.add_column(sa.Column("status_key", sa.String(length=32), nullable=True))
        batch_op.create_unique_constraint("uq_kanban_columns_status_key", ["status_key"])

    old_columns = bind.execute(sa.text("SELECT id, title FROM kanban_columns ORDER BY id")).all()
    next_id = bind.execute(
        sa.text("SELECT COALESCE(MAX(id), 0) + 1 FROM kanban_columns")
    ).scalar_one()
    canonical_ids: dict[str, int] = {}
    for offset, title in enumerate(STATUSES):
        column_id = next_id + offset
        canonical_ids[title] = column_id
        bind.execute(
            sa.text(
                "INSERT INTO kanban_columns "
                "(id, workspace_id, status_key, title, position) "
                "VALUES (:id, NULL, :key, :title, :position)"
            ),
            {
                "id": column_id,
                "key": title.lower().replace(" ", "_"),
                "title": title,
                "position": offset,
            },
        )

    bind.execute(sa.text("UPDATE kanban_cards SET position = -id"))
    for column_id, title in old_columns:
        bind.execute(
            sa.text("UPDATE kanban_cards SET column_id = :target WHERE column_id = :source"),
            {"target": canonical_ids[status_for(title)], "source": column_id},
        )
    bind.execute(sa.text("DELETE FROM kanban_columns WHERE status_key IS NULL"))
    rows = bind.execute(
        sa.text("SELECT id, column_id FROM kanban_cards ORDER BY column_id, position, id")
    ).all()
    positions: dict[int, int] = {}
    for card_id, column_id in rows:
        position = positions.get(column_id, 0)
        bind.execute(
            sa.text("UPDATE kanban_cards SET position = :position WHERE id = :id"),
            {"position": position, "id": card_id},
        )
        positions[column_id] = position + 1


def downgrade() -> None:
    bind = op.get_bind()
    workspace_id = bind.execute(sa.text("SELECT id FROM workspaces ORDER BY id LIMIT 1")).scalar()
    if workspace_id is not None:
        bind.execute(
            sa.text("UPDATE kanban_columns SET workspace_id = :workspace_id"),
            {"workspace_id": workspace_id},
        )
    with op.batch_alter_table("kanban_columns") as batch_op:
        batch_op.drop_constraint("uq_kanban_columns_status_key", type_="unique")
        batch_op.drop_column("status_key")
        if workspace_id is not None:
            batch_op.alter_column("workspace_id", existing_type=sa.Integer(), nullable=False)

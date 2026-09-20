import os
import subprocess

import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError

REQUIRED_TABLES = {
    "users",
    "workspaces",
    "workspace_members",
    "modules",
    "teaching_sessions",
    "materials",
    "templates",
    "generated_files",
    "activity_logs",
}


def test_initial_alembic_migration_builds_complete_schema(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'migration.db'}"
    result = subprocess.run(
        ["uv", "run", "alembic", "upgrade", "head"],
        check=False,
        capture_output=True,
        text=True,
        env={**os.environ, "DATABASE_URL": database_url},
    )

    assert result.returncode == 0, result.stdout + result.stderr
    tables = set(inspect(create_engine(database_url)).get_table_names())
    assert tables >= REQUIRED_TABLES
    assert "alembic_version" in tables


def test_alembic_schema_matches_model_metadata(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'migration-check.db'}"
    upgraded = subprocess.run(
        ["uv", "run", "alembic", "upgrade", "head"],
        check=False,
        capture_output=True,
        text=True,
        env={**os.environ, "DATABASE_URL": database_url},
    )
    assert upgraded.returncode == 0, upgraded.stdout + upgraded.stderr

    checked = subprocess.run(
        ["uv", "run", "alembic", "check"],
        check=False,
        capture_output=True,
        text=True,
        env={**os.environ, "DATABASE_URL": database_url},
    )

    assert checked.returncode == 0, checked.stdout + checked.stderr
    assert "No new upgrade operations detected" in checked.stdout


def test_global_kanban_migration_upgrades_populated_legacy_board(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'populated.db'}"
    env = {**os.environ, "DATABASE_URL": database_url}
    before = subprocess.run(
        ["uv", "run", "alembic", "upgrade", "7f2a9c1d4b10"],
        check=False,
        capture_output=True,
        text=True,
        env=env,
    )
    assert before.returncode == 0, before.stdout + before.stderr
    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO workspaces (id, name, slug, description, workspace_type) "
                "VALUES (1, 'Legacy', 'legacy', '', 'company')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO kanban_columns (id, workspace_id, title, position) "
                "VALUES (1, 1, 'Todo', 0)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO kanban_cards (id, column_id, title, description, position) VALUES "
                "(1, 1, 'First', NULL, 7), (2, 1, 'Second', NULL, 7)"
            )
        )

    upgraded = subprocess.run(
        ["uv", "run", "alembic", "upgrade", "head"],
        check=False,
        capture_output=True,
        text=True,
        env=env,
    )

    assert upgraded.returncode == 0, upgraded.stdout + upgraded.stderr
    with engine.connect() as connection:
        rows = connection.execute(
            text("SELECT workspace_id, position FROM kanban_cards ORDER BY position, id")
        ).all()
    assert rows == [(1, 0), (1, 1)]


def test_global_kanban_migration_prevents_duplicate_positions_per_column(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'unique-positions.db'}"
    env = {**os.environ, "DATABASE_URL": database_url}
    result = subprocess.run(
        ["uv", "run", "alembic", "upgrade", "head"],
        check=False,
        capture_output=True,
        text=True,
        env=env,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    engine = create_engine(database_url)
    constraints = inspect(engine).get_unique_constraints("kanban_cards")
    assert any(item["column_names"] == ["column_id", "position"] for item in constraints)

    with pytest.raises(IntegrityError), engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO workspaces (id, name, slug, description, workspace_type) "
                "VALUES (1, 'Workspace', 'workspace', '', 'company')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO kanban_columns (id, workspace_id, title, position) "
                "VALUES (1, 1, 'Todo', 0)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO kanban_cards "
                "(id, column_id, workspace_id, title, description, position) VALUES "
                "(1, 1, 1, 'First', NULL, 0), (2, 1, 1, 'Duplicate', NULL, 0)"
            )
        )


def test_canonical_status_migration_maps_legacy_titles_and_preserves_every_card(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'canonical-populated.db'}"
    env = {**os.environ, "DATABASE_URL": database_url}
    before = subprocess.run(
        ["uv", "run", "alembic", "upgrade", "3d44b8e9c120"],
        check=False,
        capture_output=True,
        text=True,
        env=env,
    )
    assert before.returncode == 0, before.stdout + before.stderr
    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO workspaces "
                "(id, name, slug, description, workspace_type) VALUES "
                "(1, 'One', 'one', '', 'company'), "
                "(2, 'Two', 'two', '', 'company')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO kanban_columns (id, workspace_id, title, position) VALUES "
                "(10, 1, 'Todo', 0), (11, 2, 'Sedang Dikerjakan', 0), "
                "(12, 1, 'QA', 1), (13, 2, 'Mystery', 1)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO kanban_cards "
                "(id, column_id, workspace_id, title, position) VALUES "
                "(20, 10, 1, 'todo', 0), (21, 11, 2, 'doing', 0), "
                "(22, 12, 1, 'review', 0), (23, 13, 2, 'unknown', 0)"
            )
        )
    upgraded = subprocess.run(
        ["uv", "run", "alembic", "upgrade", "head"],
        check=False,
        capture_output=True,
        text=True,
        env=env,
    )
    assert upgraded.returncode == 0, upgraded.stdout + upgraded.stderr
    with engine.connect() as connection:
        columns = connection.execute(
            text("SELECT workspace_id, title, position FROM kanban_columns ORDER BY position")
        ).all()
        cards = connection.execute(
            text(
                "SELECT kanban_cards.title, kanban_columns.title FROM kanban_cards "
                "JOIN kanban_columns ON kanban_columns.id = kanban_cards.column_id "
                "ORDER BY kanban_cards.id"
            )
        ).all()
    assert columns == [
        (None, "Backlog", 0),
        (None, "To Do", 1),
        (None, "In Progress", 2),
        (None, "Review", 3),
        (None, "Done", 4),
    ]
    assert cards == [
        ("todo", "To Do"),
        ("doing", "In Progress"),
        ("review", "Review"),
        ("unknown", "Backlog"),
    ]

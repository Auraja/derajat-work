import os
import subprocess
import sys

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.core.database import Base
from app.core.security import verify_password
from app.models import User, WorkspaceMember


def run_cli(tmp_path, *args, password):
    database_url = f"sqlite:///{tmp_path / 'cli.db'}"
    env = {**os.environ, "DATABASE_URL": database_url, "ADMIN_PASSWORD": password}
    result = subprocess.run(
        [sys.executable, "-m", "app.cli", *args],
        check=False,
        capture_output=True,
        text=True,
        env=env,
    )
    return result, database_url


def test_create_admin_cli_provisions_owner_without_exposing_password(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'cli.db'}"
    engine = create_engine(database_url)
    Base.metadata.create_all(engine)

    result, _ = run_cli(
        tmp_path,
        "create-admin",
        "--email",
        "OWNER@example.com",
        "--name",
        "Owner",
        password="never-print-this-password",
    )

    assert result.returncode == 0, result.stderr
    assert "never-print-this-password" not in result.stdout + result.stderr
    with Session(engine) as session:
        user = session.scalar(select(User).where(User.email == "owner@example.com"))
        assert user is not None
        assert user.is_admin is True
        assert (
            len(
                session.scalars(
                    select(WorkspaceMember).where(WorkspaceMember.user_id == user.id)
                ).all()
            )
            == 3
        )


def test_change_password_cli_invalidates_password_version(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'cli.db'}"
    engine = create_engine(database_url)
    Base.metadata.create_all(engine)
    created, _ = run_cli(
        tmp_path,
        "create-admin",
        "--email",
        "owner@example.com",
        "--name",
        "Owner",
        password="initial-password",
    )
    assert created.returncode == 0, created.stderr

    changed, _ = run_cli(
        tmp_path,
        "change-password",
        "--email",
        "owner@example.com",
        password="replacement-password",
    )

    assert changed.returncode == 0, changed.stderr
    with Session(engine) as session:
        user = session.scalar(select(User).where(User.email == "owner@example.com"))
        assert user is not None
        assert user.password_version == 2
        assert verify_password("replacement-password", user.password_hash)

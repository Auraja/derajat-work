from pathlib import Path

import pytest
from pydantic import ValidationError
from sqlalchemy import text

from app.core.config import Settings
from app.core.database import build_engine


def test_smoke_defaults_match_create_contracts_and_keep_workspace_scoping():
    script = (Path(__file__).parents[2] / "scripts" / "smoke.sh").read_text()
    session_default = next(
        line for line in script.splitlines() if line.startswith("session_create=")
    )
    material_default = next(
        line for line in script.splitlines() if line.startswith("material_create=")
    )

    assert '\\"workspace_id\\"' not in session_default
    assert '\\"duration\\"' not in session_default
    assert '\\"category\\"' not in material_default
    assert 'sessions_path="/api/v1/workspaces/${workspace_id}/teaching/sessions"' in script
    assert '"${MATERIALS_PATH}?workspace_id=${workspace_id}"' in script


def test_sqlite_connections_enforce_foreign_keys(tmp_path):
    engine = build_engine(f"sqlite:///{tmp_path / 'foreign-keys.db'}")
    try:
        with engine.connect() as connection:
            assert connection.scalar(text("PRAGMA foreign_keys")) == 1
    finally:
        engine.dispose()


@pytest.mark.parametrize(
    "secret",
    [
        "GANTI_DENGAN_SECRET_ACAK_MINIMAL_32_BYTE",
        "development-only-change-this-secret-key",
        "too-short",
    ],
)
def test_production_rejects_placeholder_or_short_secret(secret):
    with pytest.raises(ValidationError):
        Settings(environment="production", secret_key=secret)

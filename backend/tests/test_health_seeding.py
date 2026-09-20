import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.core.database import Base
from app.main import create_app
from app.models import Module, Workspace
from app.services.seeding import seed_default_workspaces


def test_health_contract(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'health.db'}"
    Base.metadata.create_all(create_engine(database_url))
    app = create_app(database_url=database_url)

    with TestClient(app) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_startup_does_not_create_an_unmigrated_database(tmp_path):
    app = create_app(database_url=f"sqlite:///{tmp_path / 'unmigrated.db'}")

    with pytest.raises(OperationalError, match="no such table"), TestClient(app):
        pass


def test_docs_and_openapi_are_exposed_under_api(client):
    docs = client.get("/api/docs")
    schema = client.get("/api/openapi.json")

    assert docs.status_code == 200
    assert schema.status_code == 200
    assert schema.json()["info"]["title"] == "Derajat Work API"
    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404


def test_default_workspace_seed_is_idempotent(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'seed.db'}")
    from app.core.database import Base

    Base.metadata.create_all(engine)
    with Session(engine) as session:
        seed_default_workspaces(session)
        seed_default_workspaces(session)
        workspaces = session.scalars(select(Workspace).order_by(Workspace.slug)).all()
        modules = session.scalars(select(Module).order_by(Module.name)).all()

    assert [(item.name, item.slug, item.workspace_type.value) for item in workspaces] == [
        ("PT BISA AI", "bisa-ai", "company"),
        ("Personal", "personal", "personal"),
        ("PT Solusi Kecerdasan Buatan", "solusi-kecerdasan-buatan", "company"),
    ]
    assert len(modules) == 9
    assert {module.name for module in modules} == {
        "Teaching",
        "Projects",
        "Files",
        "Clients",
        "Documents",
        "Research",
        "Notes",
    }


def test_deleted_default_workspace_is_not_recreated(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'seed-delete.db'}")
    from app.core.database import Base

    Base.metadata.create_all(engine)
    with Session(engine) as session:
        seed_default_workspaces(session)
        workspace = session.scalar(select(Workspace).where(Workspace.slug == "bisa-ai"))
        session.delete(workspace)
        session.commit()

        seed_default_workspaces(session)

        assert session.scalar(select(Workspace).where(Workspace.slug == "bisa-ai")) is None


def test_deleting_all_default_workspaces_does_not_reseed(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'seed-delete-all.db'}")
    from app.core.database import Base

    Base.metadata.create_all(engine)
    with Session(engine) as session:
        seed_default_workspaces(session)
        for workspace in session.scalars(select(Workspace)).all():
            session.delete(workspace)
        session.commit()

        seed_default_workspaces(session)

        assert list(session.scalars(select(Workspace)).all()) == []

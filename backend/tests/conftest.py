import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine

from app.core.database import Base
from app.main import create_app
from app.services.users import provision_admin


@pytest.fixture
def app(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'test.db'}"
    Base.metadata.create_all(create_engine(database_url))
    return create_app(
        database_url=database_url,
        secret_key="test-secret-key-that-is-at-least-32-bytes",
    )


@pytest.fixture
def client(app):
    with TestClient(app) as test_client:
        with app.state.session_factory() as session:
            provision_admin(
                session,
                email="admin@example.com",
                password="correct horse battery staple",
                name="Test Admin",
            )
        yield test_client


@pytest.fixture
def auth_client(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "correct horse battery staple"},
    )
    assert response.status_code == 200
    return client

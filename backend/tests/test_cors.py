from fastapi.testclient import TestClient
from sqlalchemy import create_engine

from app.core.config import Settings
from app.core.database import Base
from app.main import create_app


def create_migrated_app(database_url: str):
    Base.metadata.create_all(create_engine(database_url))
    return create_app(
        database_url=database_url,
        cors_origins=["https://work.derajat.tech"],
    )


def test_cors_origins_are_parsed_from_compose_environment(monkeypatch):
    monkeypatch.setenv(
        "DERAJAT_CORS_ORIGINS",
        "http://localhost:3100, https://work.derajat.tech ,http://localhost:3100",
    )

    settings = Settings(_env_file=None)

    assert settings.cors_origins == [
        "http://localhost:3100",
        "https://work.derajat.tech",
    ]


def test_cors_allows_configured_origin_and_credentials(tmp_path):
    app = create_migrated_app(f"sqlite:///{tmp_path / 'cors.db'}")
    with TestClient(app) as client:
        response = client.options(
            "/api/v1/auth/me",
            headers={
                "Origin": "https://work.derajat.tech",
                "Access-Control-Request-Method": "GET",
            },
        )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://work.derajat.tech"
    assert response.headers["access-control-allow-credentials"] == "true"


def test_cors_does_not_allow_unlisted_origin(tmp_path):
    app = create_migrated_app(f"sqlite:///{tmp_path / 'cors-denied.db'}")
    with TestClient(app) as client:
        response = client.options(
            "/api/v1/auth/me",
            headers={
                "Origin": "https://evil.example",
                "Access-Control-Request-Method": "GET",
            },
        )

    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers

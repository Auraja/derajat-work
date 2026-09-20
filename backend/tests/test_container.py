from pathlib import Path


def test_backend_container_runs_migrations_before_server():
    dockerfile = Path("Dockerfile").read_text()

    assert "uv sync --frozen --no-dev" in dockerfile
    assert "alembic upgrade head" in dockerfile
    assert "uvicorn app.main:app" in dockerfile
    assert dockerfile.index("alembic upgrade head") < dockerfile.index("uvicorn app.main:app")


def test_compose_passes_the_exact_frontend_proxy_address_to_backend():
    compose = Path("../docker-compose.yml").read_text()
    example = Path("../.env.example").read_text()

    assert "DERAJAT_TRUSTED_PROXY_CIDRS: ${TRUSTED_PROXY_CIDRS:-}" in compose
    assert "TRUSTED_PROXY_CIDRS=" in example

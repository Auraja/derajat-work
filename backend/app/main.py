from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import Settings, get_settings
from app.core.database import build_engine, build_session_factory
from app.services.seeding import seed_default_workspaces


def create_app(
    database_url: str | None = None,
    secret_key: str | None = None,
    cors_origins: list[str] | None = None,
) -> FastAPI:
    default_settings = get_settings()
    overrides: dict[str, object] = {}
    if database_url is not None:
        overrides["database_url"] = database_url
    if secret_key is not None:
        overrides["secret_key"] = secret_key
    if cors_origins is not None:
        overrides["cors_origins"] = cors_origins
    settings = Settings(**{**default_settings.model_dump(), **overrides})
    engine = build_engine(settings.database_url)
    session_factory = build_session_factory(engine)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        with session_factory() as session:
            seed_default_workspaces(session)
        yield
        engine.dispose()

    app = FastAPI(
        title=settings.app_name,
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
    )
    app.state.engine = engine
    app.state.session_factory = session_factory
    app.state.settings = settings
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "healthy"}

    app.include_router(api_router)
    return app


app = create_app()

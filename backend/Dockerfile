FROM python:3.13-slim AS runtime

COPY --from=ghcr.io/astral-sh/uv:0.11.6 /uv /uvx /bin/
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:${PATH}"

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY . .

RUN groupadd --system --gid 10001 derajat \
    && useradd --system --uid 10001 --gid derajat --home-dir /app derajat \
    && mkdir -p /data \
    && chown -R derajat:derajat /app /data

USER derajat
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]

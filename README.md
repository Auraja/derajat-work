# Derajat Work

Derajat Work is a personal work operating system for organizing knowledge, reusable instructions, learning material, templates, and project context in one workspace.

The goal is simple: make important work context easy to store, find, reuse, and connect instead of scattering it across notes, folders, and chat messages.

## Why it exists

Many projects accumulate useful material but lack a consistent place for:

- reusable skills and instructions
- project and workspace context
- teaching or learning sessions
- reference materials
- templates
- tasks and Kanban cards

Derajat Work brings these pieces into one private workspace-oriented application.

## Main capabilities

- Account login, profile management, and password changes
- Multiple workspaces with member access
- Reusable skills and instruction sets
- Skill orchestration plans for repeatable workflows
- Teaching and learning sessions
- Materials and reference content
- Reusable templates
- Global Kanban board with workspace-aware assignments
- SQLite persistence with migrations and seed data
- Docker-based deployment

The project includes contracts for future AI-assisted workflows. AI generation is not enabled in the current deployment, and no model, provider, or API key is required to run the application.

## How the application is organized

```text
Browser
  |
Next.js web interface
  |
FastAPI application
  |
SQLite database
```

The frontend is the user-facing workspace. The backend handles accounts, permissions, validation, business rules, and database access. The default Docker setup keeps the backend internal and exposes the frontend only through a host loopback port, making it suitable for access through a trusted reverse proxy or tunnel.

## Quick start with Docker

Requirements: Docker Engine and Docker Compose v2.

```bash
cp .env.example .env
openssl rand -hex 32
# Put the generated value in APP_SECRET_KEY

docker compose config --quiet
docker compose build
docker compose up -d
docker compose ps
```

Open the application at:

```text
http://127.0.0.1:3100
```

Create the first administrator interactively:

```bash
docker compose exec backend python -m app.cli create-admin
```

The command prompts for the email, name, and password without putting credentials in shell history.

Do not use `docker compose down -v` unless you intentionally want to remove the database volume.

## Local development

Requirements: Python, [`uv`](https://docs.astral.sh/uv/), Node.js, npm, and Docker for the full container workflow.

Backend:

```bash
cd backend
uv sync --dev
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend, in a second terminal:

```bash
cd frontend
npm ci
BACKEND_INTERNAL_URL=http://127.0.0.1:8000 NEXT_PUBLIC_API_BASE_URL=/api/v1 npm run dev
```

Run the relevant checks from each project directory. Keep local development databases separate from any deployed database.

## Configuration and privacy

Copy `.env.example` to `.env` and generate a unique `APP_SECRET_KEY` for every deployment. Common settings include the application mode, allowed browser origins, frontend port, and database volume name.

The following must stay outside Git:

- `.env` files
- production passwords and session secrets
- database files and Docker volumes
- personal workspace content
- backups and exports

## Project status

Derajat Work is an active product prototype and portfolio project. The core workspace, content, access-control, and Kanban foundations are available. AI generation is intentionally left as a future extension so the current application remains understandable, self-hostable, and useful without external services.

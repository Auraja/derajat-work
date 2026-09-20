from fastapi import APIRouter

from app.api.auth.routes import router as auth_router
from app.api.generation.routes import router as generation_router
from app.api.kanban.routes import global_router as global_kanban_router
from app.api.kanban.routes import router as kanban_router
from app.api.materials.routes import router as materials_router
from app.api.skills.routes import router as skills_router
from app.api.teaching.routes import router as teaching_router
from app.api.templates.routes import router as templates_router
from app.api.users.routes import router as users_router
from app.api.workspaces.routes import router as workspaces_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth_router)
api_router.include_router(generation_router)
api_router.include_router(kanban_router)
api_router.include_router(global_kanban_router)
api_router.include_router(materials_router)
api_router.include_router(skills_router)
api_router.include_router(teaching_router)
api_router.include_router(templates_router)
api_router.include_router(users_router)
api_router.include_router(workspaces_router)

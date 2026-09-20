from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_user
from app.models import User

router = APIRouter(prefix="/generation", tags=["generation"])
CurrentUser = Annotated[User, Depends(get_current_user)]
GenerationStatus = Literal["not_implemented"]


def _not_implemented() -> dict[str, GenerationStatus | str]:
    return {
        "status": "not_implemented",
        "message": "AI skill will be added later",
    }


@router.post("/slides")
def generate_slides(
    payload: dict[str, Any], user: CurrentUser
) -> dict[str, GenerationStatus | str]:
    return _not_implemented()


@router.post("/module")
def generate_module(
    payload: dict[str, Any], user: CurrentUser
) -> dict[str, GenerationStatus | str]:
    return _not_implemented()


@router.post("/quiz")
def generate_quiz(payload: dict[str, Any], user: CurrentUser) -> dict[str, GenerationStatus | str]:
    return _not_implemented()


@router.post("/assignment")
def generate_assignment(
    payload: dict[str, Any], user: CurrentUser
) -> dict[str, GenerationStatus | str]:
    return _not_implemented()


@router.post("/lesson-plan")
def generate_lesson_plan(
    payload: dict[str, Any], user: CurrentUser
) -> dict[str, GenerationStatus | str]:
    return _not_implemented()

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.workspace import WorkspaceType
from app.models.workspace_member import WorkspaceRole
from app.utils.slug import slugify


class ModuleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    description: str | None


class ModuleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    slug: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("slug")
    @classmethod
    def clean_slug(cls, value: str | None) -> str | None:
        return slugify(value) if value is not None else None


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    workspace_type: WorkspaceType = WorkspaceType.personal

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("slug")
    @classmethod
    def normalize_slug(cls, value: str | None) -> str | None:
        return slugify(value) if value is not None else None


class WorkspaceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    slug: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    workspace_type: WorkspaceType | None = None

    @model_validator(mode="before")
    @classmethod
    def reject_null_required_fields(cls, value: Any) -> Any:
        if isinstance(value, dict):
            invalid = {"name", "slug", "workspace_type"}.intersection(
                key for key, item in value.items() if item is None
            )
            if invalid:
                raise ValueError(f"must not be null: {', '.join(sorted(invalid))}")
        return value

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("slug")
    @classmethod
    def normalize_slug(cls, value: str | None) -> str | None:
        return slugify(value) if value is not None else None


class WorkspaceRead(BaseModel):
    id: int
    name: str
    slug: str
    description: str | None
    workspace_type: WorkspaceType
    role: WorkspaceRole
    modules: list[ModuleRead]
    created_at: datetime
    updated_at: datetime

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.utils.slug import slugify


class SkillCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    slug: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    instructions: str = Field(min_length=1, max_length=50_000)
    is_enabled: bool = True

    @field_validator("name", "instructions")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("slug")
    @classmethod
    def normalize_slug(cls, value: str | None) -> str | None:
        return slugify(value) if value is not None else None


class SkillUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    slug: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    instructions: str | None = Field(default=None, min_length=1, max_length=50_000)
    is_enabled: bool | None = None

    @model_validator(mode="before")
    @classmethod
    def reject_null_required_fields(cls, value: Any) -> Any:
        if isinstance(value, dict):
            invalid = {"name", "slug", "instructions", "is_enabled"}.intersection(
                key for key, item in value.items() if item is None
            )
            if invalid:
                raise ValueError(f"must not be null: {', '.join(sorted(invalid))}")
        return value

    @field_validator("name", "instructions")
    @classmethod
    def strip_required_text(cls, value: str | None) -> str | None:
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


class SkillRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    workspace_id: int
    name: str
    slug: str
    description: str | None
    instructions: str
    is_enabled: bool
    created_at: datetime
    updated_at: datetime


class OrchestrationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    skill_ids: list[int] = Field(default_factory=list, max_length=50)

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @model_validator(mode="after")
    def ensure_unique_skills(self) -> "OrchestrationCreate":
        if len(self.skill_ids) != len(set(self.skill_ids)):
            raise ValueError("skill_ids must be unique")
        return self


class OrchestrationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    skill_ids: list[int] | None = Field(default=None, max_length=50)

    @model_validator(mode="before")
    @classmethod
    def reject_null_required_fields(cls, value: Any) -> Any:
        if isinstance(value, dict):
            invalid = {"name", "skill_ids"}.intersection(
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

    @model_validator(mode="after")
    def ensure_unique_skills(self) -> "OrchestrationUpdate":
        if self.skill_ids is not None and len(self.skill_ids) != len(set(self.skill_ids)):
            raise ValueError("skill_ids must be unique")
        return self


class OrchestrationStepRead(BaseModel):
    position: int
    skill: SkillRead


class OrchestrationRead(BaseModel):
    id: int
    workspace_id: int
    name: str
    description: str | None
    steps: list[OrchestrationStepRead]
    created_at: datetime
    updated_at: datetime

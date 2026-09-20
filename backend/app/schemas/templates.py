from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class TemplateCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    workspace_id: int | None = None
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    template_type: str = Field(min_length=1, max_length=80)
    category: str | None = Field(default=None, max_length=120)
    config_json: dict[str, Any] = Field(default_factory=dict)


class TemplateUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    template_type: str | None = Field(default=None, min_length=1, max_length=80)
    category: str | None = Field(default=None, max_length=120)
    config_json: dict[str, Any] | None = None


class TemplateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    workspace_id: int | None
    name: str
    description: str | None
    template_type: str
    category: str | None
    config_json: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class TemplatePage(BaseModel):
    items: list[TemplateRead]
    total: int
    page: int
    page_size: int
    pages: int

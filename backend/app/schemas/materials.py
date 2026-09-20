from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, HttpUrl

from app.models.material import MaterialType


class MaterialCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    workspace_id: int
    module_id: int | None = None
    session_id: int | None = None
    title: str = Field(min_length=1, max_length=240)
    description: str | None = None
    material_type: MaterialType
    status: str = Field(default="draft", min_length=1, max_length=40)
    material_date: date | None = None
    content_url: HttpUrl | None = None
    content: str | None = None
    file_path: str | None = Field(default=None, max_length=2048)
    metadata_json: dict[str, Any] | None = None
    tags: list[str] = Field(default_factory=list, max_length=50)


class MaterialUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    module_id: int | None = None
    session_id: int | None = None
    title: str | None = Field(default=None, min_length=1, max_length=240)
    description: str | None = None
    material_type: MaterialType | None = None
    status: str | None = Field(default=None, min_length=1, max_length=40)
    material_date: date | None = None
    content_url: HttpUrl | None = None
    content: str | None = None
    file_path: str | None = Field(default=None, max_length=2048)
    metadata_json: dict[str, Any] | None = None
    tags: list[str] | None = Field(default=None, max_length=50)


class MaterialRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    workspace_id: int
    module_id: int | None
    session_id: int | None
    created_by_id: int
    title: str
    description: str | None
    material_type: MaterialType
    status: str
    material_date: date | None
    content_url: str | None
    content: str | None
    file_path: str | None
    metadata_json: dict[str, Any] | None
    tags: list[str]
    created_at: datetime
    updated_at: datetime


class MaterialPage(BaseModel):
    items: list[MaterialRead]
    total: int
    page: int
    page_size: int
    pages: int

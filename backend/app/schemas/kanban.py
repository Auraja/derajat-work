from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator

from app.models.kanban import CardPriority


class Titled(BaseModel):
    title: str = Field(min_length=1, max_length=240)

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value


class ColumnCreate(Titled):
    title: str = Field(min_length=1, max_length=160)


class ColumnUpdate(Titled):
    title: str = Field(min_length=1, max_length=160)


class CardFields(BaseModel):
    description: str | None = Field(default=None, max_length=10000)
    assignee: str | None = Field(default=None, max_length=160)
    priority: CardPriority = CardPriority.medium
    due_date: date | None = None
    start_date: date | None = None
    labels: list[str] = Field(default_factory=list, max_length=20)

    @field_validator("assignee")
    @classmethod
    def clean_optional_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None

    @field_validator("labels")
    @classmethod
    def clean_labels(cls, labels: list[str]) -> list[str]:
        cleaned = []
        for label in labels:
            value = label.strip()
            if not value or len(value) > 50:
                raise ValueError("label must contain 1-50 characters")
            if value not in cleaned:
                cleaned.append(value)
        return cleaned

    @model_validator(mode="after")
    def dates_are_ordered(self):
        if self.start_date and self.due_date and self.start_date > self.due_date:
            raise ValueError("start_date must not be after due_date")
        return self


class CardCreate(Titled, CardFields):
    column_id: int
    workspace_id: int | None = None


class CardUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=240)
    description: str | None = Field(default=None, max_length=10000)
    assignee: str | None = Field(default=None, max_length=160)
    priority: CardPriority | None = None
    due_date: date | None = None
    start_date: date | None = None
    labels: list[str] | None = Field(default=None, max_length=20)
    column_id: int | None = None
    workspace_id: int | None = None
    position: int | None = Field(default=None, ge=0)

    @field_validator(
        "title", "priority", "labels", "column_id", "workspace_id", "position", mode="before"
    )
    @classmethod
    def reject_explicit_null(cls, value: object) -> object:
        if value is None:
            raise ValueError("must not be null")
        return value

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("assignee")
    @classmethod
    def clean_assignee(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None

    @field_validator("labels")
    @classmethod
    def clean_labels(cls, labels: list[str]) -> list[str]:
        return CardFields.clean_labels(labels)


class ChecklistCreate(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    position: int | None = Field(default=None, ge=0)

    @field_validator("text")
    @classmethod
    def clean_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value


class ChecklistUpdate(BaseModel):
    text: str | None = Field(default=None, min_length=1, max_length=500)
    is_completed: bool | None = None
    position: int | None = Field(default=None, ge=0)

    @field_validator("text", "is_completed", "position", mode="before")
    @classmethod
    def reject_null(cls, value: object) -> object:
        if value is None:
            raise ValueError("must not be null")
        return value

    @field_validator("text")
    @classmethod
    def clean_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value


class AttachmentCreate(Titled):
    url: HttpUrl


class CommentCreate(BaseModel):
    author: str = Field(min_length=1, max_length=160)
    body: str = Field(min_length=1, max_length=5000)

    @field_validator("author", "body")
    @classmethod
    def clean(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value


class ChecklistRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    text: str
    is_completed: bool
    position: int
    created_at: datetime
    updated_at: datetime


class AttachmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    url: str
    created_at: datetime
    updated_at: datetime


class CommentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    author: str
    body: str
    created_at: datetime
    updated_at: datetime


class ActivityRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    actor: str
    action: str
    detail: str
    created_at: datetime


class CardRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    column_id: int
    workspace_id: int
    title: str
    description: str | None
    assignee: str | None
    priority: CardPriority
    due_date: date | None
    start_date: date | None
    labels: list[str]
    archived_at: datetime | None
    position: int
    checklist_total: int = 0
    checklist_completed: int = 0
    created_at: datetime
    updated_at: datetime


class CardDetailRead(CardRead):
    checklist_items: list[ChecklistRead]
    attachments: list[AttachmentRead]
    comments: list[CommentRead]
    activities: list[ActivityRead]


class ColumnRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    workspace_id: int | None
    title: str
    position: int
    cards: list[CardRead] = []


class BoardRead(BaseModel):
    columns: list[ColumnRead]


class BoardWorkspace(BaseModel):
    id: int
    name: str
    slug: str
    role: str
    can_write: bool


class GlobalColumnRead(ColumnRead):
    can_write: bool
    can_create: bool
    can_move_into: bool


class GlobalBoardRead(BaseModel):
    columns: list[GlobalColumnRead]
    workspaces: list[BoardWorkspace]
    archived_cards: list[CardRead] = []

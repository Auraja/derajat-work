from datetime import date, datetime
from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator

from app.models.teaching_session import TeachingStatus


class TeachingActivity(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: str = Field(min_length=1, max_length=50)
    startDate: date
    endDate: date
    mode: str | None = Field(default=None, max_length=30)

    @field_validator("type")
    @classmethod
    def activity_type_cannot_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("activity type cannot be blank")
        return value

    @field_validator("endDate")
    @classmethod
    def end_after_start(cls, value: date, info):
        start = info.data.get("startDate")
        if start and value < start:
            raise ValueError("endDate must not be before startDate")
        return value


class TeachingSessionBase(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    title: str = Field(min_length=1, max_length=240)
    topic: str | None = Field(default=None, max_length=240)
    description: str | None = None
    audience: str | None = Field(default=None, max_length=240)
    location: str | None = Field(default=None, max_length=240)
    participant_count: int | None = Field(
        default=None,
        ge=0,
        validation_alias=AliasChoices("participant_count", "participantCount"),
    )
    participant_label: str | None = Field(
        default=None,
        max_length=240,
        validation_alias=AliasChoices("participant_label", "participantLabel"),
    )
    source: Literal["manual", "external_ai"] = "manual"
    difficulty: str | None = Field(default=None, max_length=40)
    instructor: str | None = Field(default=None, max_length=200)
    instructors: list[str] = Field(default_factory=list)
    activities: list[TeachingActivity] = Field(default_factory=list)
    scheduled_at: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=1, le=1440)
    session_type: str | None = Field(default=None, max_length=80)
    session_date: date | None = None
    status: TeachingStatus = TeachingStatus.draft
    notes: str | None = None
    module_id: int | None = None


class TeachingSessionCreate(TeachingSessionBase):
    @field_validator("status")
    @classmethod
    def reserve_archived_for_archive_endpoint(cls, value: TeachingStatus) -> TeachingStatus:
        if value is TeachingStatus.archived:
            raise ValueError("archived status is reserved for the archive endpoint")
        return value


class TeachingSessionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    title: str | None = Field(default=None, min_length=1, max_length=240)
    topic: str | None = Field(default=None, max_length=240)
    description: str | None = None
    audience: str | None = Field(default=None, max_length=240)
    location: str | None = Field(default=None, max_length=240)
    participant_count: int | None = Field(
        default=None,
        ge=0,
        validation_alias=AliasChoices("participant_count", "participantCount"),
    )
    participant_label: str | None = Field(
        default=None,
        max_length=240,
        validation_alias=AliasChoices("participant_label", "participantLabel"),
    )

    difficulty: str | None = Field(default=None, max_length=40)
    instructor: str | None = Field(default=None, max_length=200)
    instructors: list[str] | None = None
    activities: list[TeachingActivity] | None = None
    scheduled_at: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=1, le=1440)
    session_type: str | None = Field(default=None, max_length=80)
    session_date: date | None = None
    status: TeachingStatus | None = None
    notes: str | None = None
    module_id: int | None = None

    @field_validator("title", "status")
    @classmethod
    def required_fields_cannot_be_null(cls, value):
        if value is None:
            raise ValueError("required fields cannot be null")
        return value

    @field_validator("instructors", "activities")
    @classmethod
    def schedule_lists_cannot_be_null(cls, value):
        if value is None:
            raise ValueError("schedule lists cannot be null")
        return value

    @field_validator("status")
    @classmethod
    def reserve_archived_for_archive_endpoint(
        cls, value: TeachingStatus | None
    ) -> TeachingStatus | None:
        if value is TeachingStatus.archived:
            raise ValueError("archived status is reserved for the archive endpoint")
        return value


class TeachingSessionRead(TeachingSessionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    workspace_id: int
    created_by_id: int
    created_at: datetime
    updated_at: datetime


class TeachingSessionPage(BaseModel):
    items: list[TeachingSessionRead]
    total: int
    page: int
    page_size: int
    pages: int


class TeachingSessionImportItem(TeachingSessionCreate):
    title: str = Field(min_length=1, max_length=240)
    instructors: list[str] = Field(default=..., min_length=1)
    activities: list[TeachingActivity] = Field(default=..., min_length=1)

    @field_validator("title")
    @classmethod
    def import_title_cannot_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("title cannot be blank")
        return value

    @field_validator("instructors")
    @classmethod
    def import_instructors_cannot_be_blank(cls, value: list[str]) -> list[str]:
        names = [name.strip() for name in value]
        if any(not name for name in names):
            raise ValueError("instructors cannot contain blank names")
        return names


class TeachingSessionImport(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sessions: list[TeachingSessionImportItem] = Field(min_length=1, max_length=100)

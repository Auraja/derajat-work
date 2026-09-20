from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.teaching_session import TeachingStatus


class TeachingSessionBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=240)
    topic: str | None = Field(default=None, max_length=240)
    description: str | None = None
    audience: str | None = Field(default=None, max_length=240)
    difficulty: str | None = Field(default=None, max_length=40)
    instructor: str | None = Field(default=None, max_length=200)
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
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=240)
    topic: str | None = Field(default=None, max_length=240)
    description: str | None = None
    audience: str | None = Field(default=None, max_length=240)
    difficulty: str | None = Field(default=None, max_length=40)
    instructor: str | None = Field(default=None, max_length=200)
    scheduled_at: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=1, le=1440)
    session_type: str | None = Field(default=None, max_length=80)
    session_date: date | None = None
    status: TeachingStatus | None = None
    notes: str | None = None
    module_id: int | None = None

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

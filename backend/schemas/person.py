"""مخططات الأشخاص ولوحة التحكم"""
from datetime import datetime

from pydantic import BaseModel, Field


class PersonOut(BaseModel):
    id: int
    name: str
    phone: str
    attendance_confirmed: bool
    confirmed_at: datetime | None = None
    admin_note: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class PersonListResponse(BaseModel):
    items: list[PersonOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class NoteUpdateRequest(BaseModel):
    admin_note: str | None = Field(default=None, max_length=1000)


class StatisticsResponse(BaseModel):
    total_people: int
    confirmed_people: int
    not_confirmed_people: int
    confirmation_percentage: float
    last_confirmation_at: datetime | None = None
    confirmations_today: int = 0


class ImportRowIssue(BaseModel):
    row: int
    name: str | None = None
    phone: str | None = None
    reason: str


class ImportResultResponse(BaseModel):
    mode: str
    total_rows: int
    imported: int
    updated: int
    skipped_duplicates_in_file: int
    skipped_existing: int
    invalid_rows: int
    deleted_existing: int = 0
    issues: list[ImportRowIssue] = []
    message: str

"""مخططات تأكيد الحضور (الواجهة العامة)"""
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class AttendanceConfirmRequest(BaseModel):
    """رقم الهاتف هو المعرّف الوحيد المطلوب لتأكيد الحضور"""

    phone: str = Field(..., min_length=6, max_length=32, description="رقم الهاتف")

    @field_validator("phone")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("رقم الهاتف مطلوب")
        return v


class AttendanceConfirmResponse(BaseModel):
    status: str  # confirmed | already_confirmed | not_found
    message: str
    name: str | None = None
    phone: str | None = None
    confirmed_at: datetime | None = None
    event_name: str | None = None
    event_place: str | None = None

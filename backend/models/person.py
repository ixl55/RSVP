"""جدول الأشخاص المقبولين"""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from database import Base
from utils.timeutil import utcnow


class Person(Base):
    __tablename__ = "people"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # البيانات كما وردت في ملف Excel (للعرض)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    phone: Mapped[str] = mapped_column(String(32), nullable=False, index=True)

    # نسخ موحّدة تُستخدم للمطابقة ومنع التكرار فقط
    name_normalized: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    phone_normalized: Mapped[str] = mapped_column(
        String(32), nullable=False, unique=True, index=True
    )

    attendance_confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    admin_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    __table_args__ = (
        Index("ix_people_match", "name_normalized", "phone_normalized"),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Person {self.id} {self.name} {self.phone}>"

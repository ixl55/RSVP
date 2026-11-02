"""أدوات الوقت - التخزين بتوقيت UTC والعرض بتوقيت الفعالية"""
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from config import settings

try:
    EVENT_TZ = ZoneInfo(settings.timezone)
except Exception:  # في حال عدم توفر قاعدة بيانات المناطق الزمنية
    EVENT_TZ = timezone.utc


def utcnow() -> datetime:
    """الوقت الحالي بتوقيت UTC (بدون tzinfo لتخزينه في SQLite)"""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def to_local(dt: datetime | None) -> datetime | None:
    """تحويل وقت UTC المخزّن إلى التوقيت المحلي للفعالية"""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(EVENT_TZ)


def format_local(dt: datetime | None, fmt: str = "%Y-%m-%d %H:%M") -> str:
    """تنسيق الوقت للعرض في ملفات التصدير"""
    local = to_local(dt)
    return local.strftime(fmt) if local else ""

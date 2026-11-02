"""إعدادات التطبيق - تُقرأ من ملف .env"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "نظام تأكيد الحضور"
    event_name: str = "مؤتمر يوم الشباب العالمي - العراق"
    event_place: str = "فندق موفنبيك - المنطقة الخضراء"

    database_url: str = "sqlite:///./data/attendance.db"

    secret_key: str = "change-me-please-use-a-long-random-string"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 720

    admin_username: str = "admin"
    admin_password: str = "Admin@12345"

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    timezone: str = "Asia/Baghdad"

    # تحديد المحاولات لكل عنوان IP (ارفع قيمة التأكيد إن كان الحضور
    # يتصلون عبر شبكة واحدة مشتركة في القاعة)
    attendance_rate_limit: int = 40
    attendance_rate_window: int = 300
    login_rate_limit: int = 8
    login_rate_window: int = 300

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

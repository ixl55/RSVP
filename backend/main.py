"""نقطة تشغيل التطبيق - نظام تأكيد الحضور"""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from config import settings
from database import Base, SessionLocal, engine
from models.admin import Admin
from models.person import Person  # noqa: F401 - مطلوب لإنشاء الجدول
from routers import admin as admin_router
from routers import attendance as attendance_router
from routers import auth as auth_router
from utils.security import hash_password

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger("attendance")

# مجلد ملفات الواجهة المبنية (frontend/dist) لتشغيل النظام من خادم واحد
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"


def create_default_admin() -> None:
    """إنشاء حساب الأدمن الافتراضي عند أول تشغيل"""
    db = SessionLocal()
    try:
        if db.query(Admin).count() == 0:
            admin = Admin(
                username=settings.admin_username,
                hashed_password=hash_password(settings.admin_password),
                full_name="مدير النظام",
            )
            db.add(admin)
            db.commit()
            logger.info("تم إنشاء حساب الأدمن الافتراضي: %s", settings.admin_username)
            if settings.admin_password == "Admin@12345":
                logger.warning("تنبيه أمني: كلمة مرور الأدمن الافتراضية مستخدمة. غيّرها من ملف .env أو من لوحة التحكم.")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    create_default_admin()
    logger.info("النظام جاهز | %s", settings.event_name)
    yield


app = FastAPI(
    title=settings.app_name,
    description="نظام تأكيد حضور المقبولين اعتماداً على قائمة Excel",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    """رسائل تحقق بالعربية بدلاً من رسائل Pydantic الإنجليزية"""
    return JSONResponse(
        status_code=422,
        content={"detail": "البيانات المُدخلة غير صحيحة. يرجى مراجعة الحقول والمحاولة مجدداً."},
    )


app.include_router(auth_router.router)
app.include_router(attendance_router.router)
app.include_router(admin_router.router)


@app.get("/api/health", tags=["system"])
def health():
    return {"status": "ok", "app": settings.app_name, "event": settings.event_name}


# ==== تقديم واجهة React المبنية (اختياري - بعد تنفيذ npm run build) ====
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        """توجيه كل المسارات غير الخاصة بالـ API إلى تطبيق React"""
        candidate = FRONTEND_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST / "index.html")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

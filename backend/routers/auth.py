"""مسارات مصادقة الأدمن"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models.admin import Admin
from schemas.auth import AdminOut, ChangePasswordRequest, LoginRequest, TokenResponse
from utils.deps import get_current_admin
from utils.ratelimit import login_limiter
from utils.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _client_key(request: Request) -> str:
    return request.client.host if request.client else "unknown"


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """تسجيل دخول الأدمن وإصدار رمز JWT"""
    allowed, retry_after = login_limiter.check(_client_key(request))
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"عدد محاولات الدخول كبير. يرجى المحاولة بعد {retry_after} ثانية.",
        )

    admin = db.query(Admin).filter(Admin.username == payload.username.strip()).first()
    if admin is None or not verify_password(payload.password, admin.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="اسم المستخدم أو كلمة المرور غير صحيحة.",
        )
    if not admin.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="هذا الحساب معطّل.")

    login_limiter.reset(_client_key(request))
    token = create_access_token(subject=admin.username)
    return TokenResponse(
        access_token=token,
        username=admin.username,
        expires_in_minutes=settings.access_token_expire_minutes,
    )


@router.get("/me", response_model=AdminOut)
def me(admin: Admin = Depends(get_current_admin)):
    """بيانات الأدمن الحالي - تُستخدم للتحقق من صلاحية الجلسة"""
    return admin


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """تغيير كلمة مرور الأدمن الحالي"""
    if not verify_password(payload.current_password, admin.hashed_password):
        raise HTTPException(status_code=400, detail="كلمة المرور الحالية غير صحيحة.")

    admin.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"message": "تم تغيير كلمة المرور بنجاح."}

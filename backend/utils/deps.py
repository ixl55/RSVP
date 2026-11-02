"""Dependencies مشتركة - حماية مسارات الأدمن"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from database import get_db
from models.admin import Admin
from utils.security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)

CREDENTIALS_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="الجلسة غير صالحة أو منتهية. يرجى تسجيل الدخول مجدداً.",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Admin:
    if credentials is None or not credentials.credentials:
        raise CREDENTIALS_ERROR

    payload = decode_access_token(credentials.credentials)
    if not payload or not payload.get("sub"):
        raise CREDENTIALS_ERROR

    admin = db.query(Admin).filter(Admin.username == payload["sub"]).first()
    if admin is None or not admin.is_active:
        raise CREDENTIALS_ERROR

    return admin

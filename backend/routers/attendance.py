"""مسارات تأكيد الحضور العامة (بدون مصادقة)"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import update
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models.person import Person
from schemas.attendance import AttendanceConfirmRequest, AttendanceConfirmResponse
from utils.normalize import normalize_phone
from utils.ratelimit import attendance_limiter, status_limiter
from utils.timeutil import utcnow

router = APIRouter(prefix="/api/attendance", tags=["attendance"])

NOT_FOUND_MESSAGE = (
    "عذراً، لم يتم العثور على رقم هاتفك ضمن قائمة المقبولين. "
    "يرجى التأكد من الرقم المستخدم أثناء التسجيل."
)


@router.get("/event-info")
def event_info():
    """معلومات الفعالية لعرضها في الصفحة العامة"""
    return {
        "app_name": settings.app_name,
        "event_name": settings.event_name,
        "event_place": settings.event_place,
    }


@router.get("/status", response_model=AttendanceConfirmResponse)
def attendance_status(
    phone: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    الاستعلام عن حالة رقم دون تغيير أي شيء.

    تستخدمه الصفحة العامة للتحقق من أن التأكيد المحفوظ على الجهاز
    ما زال صحيحاً في قاعدة البيانات (مثلاً بعد إعادة رفع قائمة المقبولين).

    الحالات: confirmed | not_confirmed | not_found
    """
    allowed, retry_after = status_limiter.check(request.client.host if request.client else "unknown")
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"عدد الطلبات كبير جداً. يرجى المحاولة بعد {retry_after} ثانية.",
        )

    phone_norm = normalize_phone(phone)
    person = (
        db.query(Person).filter(Person.phone_normalized == phone_norm).first()
        if phone_norm
        else None
    )

    if person is None:
        return AttendanceConfirmResponse(status="not_found", message=NOT_FOUND_MESSAGE)

    if not person.attendance_confirmed:
        return AttendanceConfirmResponse(
            status="not_confirmed",
            message="لم يتم تأكيد الحضور لهذا الرقم بعد.",
            name=person.name,
            phone=person.phone,
        )

    return AttendanceConfirmResponse(
        status="confirmed",
        message="تم تأكيد حضورك.",
        name=person.name,
        phone=person.phone,
        confirmed_at=person.confirmed_at,
        event_name=settings.event_name,
        event_place=settings.event_place,
    )


@router.post("/confirm", response_model=AttendanceConfirmResponse)
def confirm_attendance(
    payload: AttendanceConfirmRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    تأكيد حضور شخص موجود مسبقاً في قائمة المقبولين — برقم الهاتف فقط.
    رقم الهاتف هو المعرّف الفريد لكل شخص، ولا يتم إنشاء أي سجل جديد إطلاقاً.

    الحالات المُعادة في الحقل status:
      - confirmed         : تم التأكيد الآن بنجاح
      - already_confirmed : سبق له التأكيد
      - not_found         : الرقم غير موجود ضمن المقبولين
    """
    allowed, retry_after = attendance_limiter.check(request.client.host if request.client else "unknown")
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"عدد المحاولات كبير جداً. يرجى المحاولة بعد {retry_after} ثانية.",
        )

    phone_norm = normalize_phone(payload.phone)
    if not phone_norm:
        return AttendanceConfirmResponse(status="not_found", message=NOT_FOUND_MESSAGE)

    person = db.query(Person).filter(Person.phone_normalized == phone_norm).first()
    if person is None:
        return AttendanceConfirmResponse(status="not_found", message=NOT_FOUND_MESSAGE)

    if person.attendance_confirmed:
        return AttendanceConfirmResponse(
            status="already_confirmed",
            message="لقد تم تأكيد حضورك مسبقاً.",
            name=person.name,
            phone=person.phone,
            confirmed_at=person.confirmed_at,
            event_name=settings.event_name,
            event_place=settings.event_place,
        )

    # تحديث مشروط يضمن عملية تأكيد واحدة فقط حتى مع الطلبات المتزامنة
    now = utcnow()
    result = db.execute(
        update(Person)
        .where(Person.id == person.id, Person.attendance_confirmed.is_(False))
        .values(attendance_confirmed=True, confirmed_at=now)
    )
    db.commit()
    db.refresh(person)

    if result.rowcount == 0:
        # سبق تأكيده في نفس اللحظة من طلب آخر
        return AttendanceConfirmResponse(
            status="already_confirmed",
            message="لقد تم تأكيد حضورك مسبقاً.",
            name=person.name,
            phone=person.phone,
            confirmed_at=person.confirmed_at,
            event_name=settings.event_name,
            event_place=settings.event_place,
        )

    return AttendanceConfirmResponse(
        status="confirmed",
        message="تم تسجيل تأكيد حضورك بنجاح. نتطلع إلى رؤيتك في الفعالية.",
        name=person.name,
        phone=person.phone,
        confirmed_at=person.confirmed_at,
        event_name=settings.event_name,
        event_place=settings.event_place,
    )

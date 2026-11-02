"""مسارات لوحة تحكم الأدمن (محمية بـ JWT)"""
from __future__ import annotations

import urllib.parse
from datetime import timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile
from sqlalchemy import asc, desc, func, or_
from sqlalchemy.orm import Session

from database import get_db
from models.person import Person
from schemas.person import (
    ImportResultResponse,
    NoteUpdateRequest,
    PersonListResponse,
    PersonOut,
    StatisticsResponse,
)
from services.excel_service import ExcelImportError, import_people
from services.export_service import build_people_workbook, build_template_workbook
from utils.deps import get_current_admin
from utils.normalize import clean_text, normalize_name, normalize_phone
from utils.timeutil import to_local, utcnow

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(get_current_admin)])

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 ميغابايت

SORT_FIELDS = {
    "name": Person.name,
    "phone": Person.phone,
    "status": Person.attendance_confirmed,
    "confirmed_at": Person.confirmed_at,
    "created_at": Person.created_at,
    "id": Person.id,
}


def _apply_filters(query, search: str | None, status_filter: str):
    if status_filter == "confirmed":
        query = query.filter(Person.attendance_confirmed.is_(True))
    elif status_filter == "not_confirmed":
        query = query.filter(Person.attendance_confirmed.is_(False))

    search = clean_text(search)
    if search:
        like = f"%{search}%"
        conditions = [Person.name.ilike(like), Person.phone.ilike(like)]

        # البحث بالاسم بعد التوحيد (يتجاهل الهمزات والتشكيل)
        name_norm = normalize_name(search)
        if name_norm:
            conditions.append(Person.name_normalized.ilike(f"%{name_norm}%"))

        # البحث برقم الهاتف بأي صيغة (+964 / 00964 / 07...)
        phone_norm = normalize_phone(search)
        if phone_norm and len(phone_norm) >= 3:
            conditions.append(Person.phone_normalized.ilike(f"%{phone_norm}%"))

        query = query.filter(or_(*conditions))

    return query


@router.get("/statistics", response_model=StatisticsResponse)
def statistics(db: Session = Depends(get_db)):
    """إحصائيات لوحة التحكم"""
    total = db.query(func.count(Person.id)).scalar() or 0
    confirmed = (
        db.query(func.count(Person.id)).filter(Person.attendance_confirmed.is_(True)).scalar() or 0
    )
    last_confirmation = db.query(func.max(Person.confirmed_at)).scalar()

    # عدد تأكيدات آخر 24 ساعة
    since = utcnow() - timedelta(hours=24)
    today_count = (
        db.query(func.count(Person.id))
        .filter(Person.attendance_confirmed.is_(True), Person.confirmed_at >= since)
        .scalar()
        or 0
    )

    percentage = round((confirmed / total) * 100, 2) if total else 0.0

    return StatisticsResponse(
        total_people=total,
        confirmed_people=confirmed,
        not_confirmed_people=total - confirmed,
        confirmation_percentage=percentage,
        last_confirmation_at=last_confirmation,
        confirmations_today=today_count,
    )


@router.get("/people", response_model=PersonListResponse)
def list_people(
    db: Session = Depends(get_db),
    search: str | None = Query(default=None, description="بحث بالاسم أو رقم الهاتف"),
    status_filter: str = Query(default="all", pattern="^(all|confirmed|not_confirmed)$", alias="status"),
    sort_by: str = Query(default="created_at"),
    sort_dir: str = Query(default="asc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
):
    """قائمة الأشخاص مع البحث والفلترة والترتيب والتقسيم لصفحات"""
    query = _apply_filters(db.query(Person), search, status_filter)

    total = query.with_entities(func.count(Person.id)).scalar() or 0

    column = SORT_FIELDS.get(sort_by, Person.created_at)
    order = asc(column) if sort_dir == "asc" else desc(column)
    query = query.order_by(order, Person.id.asc())

    items = query.offset((page - 1) * page_size).limit(page_size).all()
    total_pages = (total + page_size - 1) // page_size if total else 0

    return PersonListResponse(
        items=[PersonOut.model_validate(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/people/{person_id}", response_model=PersonOut)
def get_person(person_id: int, db: Session = Depends(get_db)):
    person = db.get(Person, person_id)
    if person is None:
        raise HTTPException(status_code=404, detail="الشخص غير موجود.")
    return person


@router.put("/people/{person_id}/note", response_model=PersonOut)
def update_note(person_id: int, payload: NoteUpdateRequest, db: Session = Depends(get_db)):
    """إضافة أو تعديل ملاحظة الأدمن لشخص معيّن"""
    person = db.get(Person, person_id)
    if person is None:
        raise HTTPException(status_code=404, detail="الشخص غير موجود.")

    note = clean_text(payload.admin_note)
    person.admin_note = note or None
    db.commit()
    db.refresh(person)
    return person


@router.put("/people/{person_id}/attendance", response_model=PersonOut)
def set_attendance(
    person_id: int,
    confirmed: bool = Query(..., description="حالة الحضور المطلوبة"),
    db: Session = Depends(get_db),
):
    """تعديل حالة الحضور يدوياً من قبل الأدمن (تأكيد أو تراجع)"""
    person = db.get(Person, person_id)
    if person is None:
        raise HTTPException(status_code=404, detail="الشخص غير موجود.")

    person.attendance_confirmed = confirmed
    person.confirmed_at = utcnow() if confirmed else None
    db.commit()
    db.refresh(person)
    return person


@router.post("/import-excel", response_model=ImportResultResponse)
async def import_excel(
    file: UploadFile = File(..., description="ملف Excel يحتوي على: الاسم | رقم الهاتف"),
    mode: str = Form(default="append", description="append أو replace"),
    dry_run: bool = Form(default=False, description="تحليل الملف دون حفظ"),
    db: Session = Depends(get_db),
):
    """رفع ملف Excel واستيراد المقبولين مع تقرير مفصّل"""
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="الملف فارغ.")
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="حجم الملف كبير جداً. الحد الأقصى 10 ميغابايت.")

    try:
        report = import_people(
            db=db,
            file_bytes=contents,
            filename=file.filename or "",
            mode=mode,
            dry_run=dry_run,
        )
    except ExcelImportError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"حدث خطأ أثناء معالجة الملف: {exc}")

    if dry_run:
        message = (
            f"معاينة الملف: سيتم استيراد {report.imported} شخصاً. "
            f"تم تجاهل {report.skipped_existing} موجوداً مسبقاً، "
            f"{report.skipped_duplicates_in_file} مكرراً داخل الملف، "
            f"و{report.invalid_rows} صفاً غير صالح. لم يتم حفظ أي بيانات بعد."
        )
    elif report.mode == "replace":
        message = (
            f"تم استبدال القائمة بالكامل. حُذف {report.deleted_existing} سجلاً سابقاً "
            f"وتم استيراد {report.imported} شخصاً."
        )
    else:
        message = (
            f"تمت إضافة {report.imported} شخصاً جديداً إلى القائمة. "
            f"تم تجاهل {report.skipped_existing} موجوداً مسبقاً "
            f"و{report.skipped_duplicates_in_file} مكرراً داخل الملف."
        )

    return ImportResultResponse(
        mode=report.mode,
        total_rows=report.total_rows,
        imported=report.imported,
        updated=report.updated,
        skipped_duplicates_in_file=report.skipped_duplicates_in_file,
        skipped_existing=report.skipped_existing,
        invalid_rows=report.invalid_rows,
        deleted_existing=report.deleted_existing,
        issues=report.issues,
        message=message,
    )


@router.get("/export-excel")
def export_excel(
    scope: str = Query(default="all", pattern="^(all|confirmed|not_confirmed)$"),
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """تصدير البيانات إلى ملف Excel منسّق (all | confirmed | not_confirmed)"""
    query = _apply_filters(db.query(Person), search, scope)
    people = query.order_by(Person.attendance_confirmed.desc(), Person.name.asc()).all()

    content, filename = build_people_workbook(people, scope=scope)
    quoted = urllib.parse.quote(filename)
    disposition = 'attachment; filename="{0}"; filename*=UTF-8\'\'{1}'.format(filename, quoted)

    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": disposition,
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.get("/excel-template")
def excel_template():
    """تنزيل قالب Excel جاهز للتعبئة"""
    content, filename = build_template_workbook()
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.delete("/people")
def delete_all_people(
    confirm: str = Query(..., description="اكتب DELETE للتأكيد"),
    db: Session = Depends(get_db),
):
    """حذف جميع السجلات - عملية غير قابلة للتراجع"""
    if confirm != "DELETE":
        raise HTTPException(status_code=400, detail="لم يتم تأكيد عملية الحذف.")

    deleted = db.query(Person).delete(synchronize_session=False)
    db.commit()
    return {"message": f"تم حذف {deleted} سجلاً.", "deleted": deleted}


@router.get("/recent-confirmations", response_model=list[PersonOut])
def recent_confirmations(
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """آخر التأكيدات - تُعرض في لوحة التحكم"""
    return (
        db.query(Person)
        .filter(Person.attendance_confirmed.is_(True))
        .order_by(Person.confirmed_at.desc())
        .limit(limit)
        .all()
    )


@router.get("/hourly-confirmations")
def hourly_confirmations(db: Session = Depends(get_db)):
    """توزيع التأكيدات على آخر 24 ساعة - لرسم بياني بسيط"""
    since = utcnow() - timedelta(hours=24)
    rows = (
        db.query(Person.confirmed_at)
        .filter(Person.attendance_confirmed.is_(True), Person.confirmed_at >= since)
        .all()
    )

    buckets: dict[str, int] = {}
    for (dt,) in rows:
        local = to_local(dt)
        if local:
            key = local.strftime("%H:00")
            buckets[key] = buckets.get(key, 0) + 1

    return {"buckets": [{"hour": k, "count": v} for k, v in sorted(buckets.items())]}

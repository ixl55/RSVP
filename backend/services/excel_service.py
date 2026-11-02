"""قراءة ملف Excel واستيراد المقبولين إلى قاعدة البيانات"""
from __future__ import annotations

import csv
import io
from dataclasses import dataclass, field

from openpyxl import load_workbook
from sqlalchemy import select
from sqlalchemy.orm import Session

from models.person import Person
from utils.normalize import clean_text, normalize_name, normalize_phone, phone_is_valid

# الأسماء المقبولة لأعمدة الملف (عربي/إنجليزي)
NAME_HEADERS = {
    "الاسم", "الأسم", "اسم", "الاسم الكامل", "الاسم الثلاثي", "الاسم الرباعي",
    "اسم الشخص", "اسم المشارك", "المشارك", "الاسم الكامل للمشارك",
    "name", "full name", "fullname", "full_name", "person name", "participant",
}
PHONE_HEADERS = {
    "رقم الهاتف", "الهاتف", "رقم الموبايل", "الموبايل", "رقم الجوال", "الجوال",
    "رقم التلفون", "التلفون", "رقم", "هاتف", "phone", "phone number", "mobile",
    "mobile number", "phone_number", "tel", "telephone", "whatsapp", "رقم الواتساب",
}

MAX_ISSUES_RETURNED = 200


@dataclass
class ImportReport:
    mode: str = "append"
    total_rows: int = 0
    imported: int = 0
    updated: int = 0
    skipped_duplicates_in_file: int = 0
    skipped_existing: int = 0
    invalid_rows: int = 0
    deleted_existing: int = 0
    issues: list[dict] = field(default_factory=list)

    def add_issue(self, row: int, name, phone, reason: str) -> None:
        if len(self.issues) < MAX_ISSUES_RETURNED:
            self.issues.append(
                {"row": row, "name": clean_text(name) or None, "phone": clean_text(phone) or None, "reason": reason}
            )


class ExcelImportError(Exception):
    """خطأ في بنية الملف يمنع الاستيراد كلياً"""


def _header_key(value) -> str:
    return clean_text(value).lower().replace("ـ", "").strip()


def _find_columns(rows: list[list]) -> tuple[int, int, int]:
    """
    البحث عن صف العناوين وتحديد موقع عمودي الاسم والهاتف.
    تُرجع: (فهرس صف العناوين، فهرس عمود الاسم، فهرس عمود الهاتف)
    """
    for row_idx, row in enumerate(rows[:20]):  # العناوين عادة ضمن أول 20 صفاً
        name_col = phone_col = -1
        for col_idx, cell in enumerate(row):
            key = _header_key(cell)
            if not key:
                continue
            if name_col == -1 and key in NAME_HEADERS:
                name_col = col_idx
            elif phone_col == -1 and key in PHONE_HEADERS:
                phone_col = col_idx
        if name_col != -1 and phone_col != -1:
            return row_idx, name_col, phone_col

    raise ExcelImportError(
        "تعذّر العثور على الأعمدة المطلوبة في الملف. "
        "يجب أن يحتوي الملف على عمود باسم «الاسم» وعمود باسم «رقم الهاتف»."
    )


def read_rows(file_bytes: bytes, filename: str) -> list[list]:
    """قراءة كل صفوف الملف (Excel أو CSV) كقائمة قوائم"""
    lower = (filename or "").lower()

    if lower.endswith(".csv"):
        for encoding in ("utf-8-sig", "utf-8", "cp1256"):
            try:
                text = file_bytes.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        else:
            raise ExcelImportError("تعذّر قراءة ترميز ملف CSV.")
        return [list(r) for r in csv.reader(io.StringIO(text))]

    if not lower.endswith((".xlsx", ".xlsm")):
        raise ExcelImportError("صيغة الملف غير مدعومة. الصيغ المقبولة: .xlsx أو .xlsm أو .csv")

    try:
        workbook = load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
    except Exception as exc:
        raise ExcelImportError(f"تعذّر فتح ملف Excel: تأكد أن الملف سليم وغير محمي بكلمة مرور. ({exc})")

    sheet = workbook.active
    rows = [list(r) for r in sheet.iter_rows(values_only=True)]
    workbook.close()
    return rows


def import_people(
    db: Session,
    file_bytes: bytes,
    filename: str,
    mode: str = "append",
    dry_run: bool = False,
) -> ImportReport:
    """
    استيراد المقبولين من ملف Excel.

    mode:
      - append : إضافة الأشخاص الجدد فقط مع تجاهل الموجود مسبقاً (لا يمسّ التأكيدات)
      - replace: حذف القائمة الحالية بالكامل ثم استيراد الملف الجديد
    dry_run: تحليل الملف وعرض التقرير دون أي تعديل على قاعدة البيانات
    """
    if mode not in ("append", "replace"):
        raise ExcelImportError("خيار الاستيراد غير صحيح.")

    rows = read_rows(file_bytes, filename)
    if not rows:
        raise ExcelImportError("الملف فارغ ولا يحتوي على أي بيانات.")

    header_idx, name_col, phone_col = _find_columns(rows)
    data_rows = rows[header_idx + 1:]

    report = ImportReport(mode=mode)

    # الأرقام الموجودة حالياً في قاعدة البيانات
    if mode == "replace":
        existing_phones: dict[str, Person] = {}
        report.deleted_existing = db.query(Person).count()
    else:
        existing_phones = {
            p.phone_normalized: p for p in db.execute(select(Person)).scalars().all()
        }

    seen_in_file: set[str] = set()
    to_insert: list[Person] = []

    for offset, row in enumerate(data_rows):
        excel_row_number = header_idx + 2 + offset  # رقم الصف كما يظهر في Excel

        raw_name = row[name_col] if name_col < len(row) else None
        raw_phone = row[phone_col] if phone_col < len(row) else None

        name = clean_text(raw_name)
        phone_raw = clean_text(raw_phone)

        # تجاهل الصفوف الفارغة تماماً دون احتسابها
        if not name and not phone_raw:
            continue

        report.total_rows += 1

        if not name:
            report.invalid_rows += 1
            report.add_issue(excel_row_number, raw_name, raw_phone, "الاسم مفقود")
            continue

        if len(name) < 2:
            report.invalid_rows += 1
            report.add_issue(excel_row_number, raw_name, raw_phone, "الاسم قصير جداً أو غير صالح")
            continue

        if not phone_raw:
            report.invalid_rows += 1
            report.add_issue(excel_row_number, raw_name, raw_phone, "رقم الهاتف مفقود")
            continue

        phone_norm = normalize_phone(phone_raw)
        if not phone_norm or len(phone_norm) < 8:
            report.invalid_rows += 1
            report.add_issue(excel_row_number, raw_name, raw_phone, "رقم الهاتف غير صالح")
            continue

        if not phone_is_valid(phone_norm):
            # رقم غير عراقي/غير قياسي - نستورده لكن ننبّه الأدمن
            report.add_issue(
                excel_row_number, raw_name, raw_phone,
                "تم استيراده مع تنبيه: الرقم لا يطابق صيغة الموبايل العراقي (07XXXXXXXXX)",
            )

        if phone_norm in seen_in_file:
            report.skipped_duplicates_in_file += 1
            report.add_issue(excel_row_number, raw_name, raw_phone, "رقم مكرر داخل نفس الملف")
            continue

        seen_in_file.add(phone_norm)

        existing = existing_phones.get(phone_norm)
        if existing is not None:
            report.skipped_existing += 1
            report.add_issue(
                excel_row_number, raw_name, raw_phone,
                f"موجود مسبقاً في القائمة باسم: {existing.name}",
            )
            continue

        to_insert.append(
            Person(
                name=name,
                phone=phone_norm,
                name_normalized=normalize_name(name),
                phone_normalized=phone_norm,
                attendance_confirmed=False,
            )
        )

    report.imported = len(to_insert)

    if dry_run:
        return report

    try:
        if mode == "replace":
            db.query(Person).delete(synchronize_session=False)
            db.flush()
        if to_insert:
            db.add_all(to_insert)
        db.commit()
    except Exception:
        db.rollback()
        raise

    return report

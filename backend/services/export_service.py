"""إنشاء ملفات Excel للتصدير"""
from __future__ import annotations

import io
from datetime import datetime

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo

from config import settings
from models.person import Person
from utils.timeutil import format_local, to_local

HEADERS = ["#", "الاسم", "رقم الهاتف", "حالة الحضور", "تاريخ التأكيد", "وقت التأكيد", "ملاحظة الأدمن"]

SCOPE_LABEL = {
    "all": "جميع الأشخاص",
    "confirmed": "المؤكدون فقط",
    "not_confirmed": "غير المؤكدين",
}

HEADER_FILL = PatternFill("solid", fgColor="0F5132")
TITLE_FONT = Font(name="Calibri", size=14, bold=True, color="0F5132")
HEADER_FONT = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
CONFIRMED_FILL = PatternFill("solid", fgColor="E7F6EC")
PENDING_FILL = PatternFill("solid", fgColor="FDF3F3")

THIN = Side(style="thin", color="D6D6D6")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def build_people_workbook(people: list[Person], scope: str = "all") -> tuple[bytes, str]:
    """إنشاء ملف Excel منسّق. تُرجع (محتوى الملف، اسم الملف)"""
    wb = Workbook()
    ws = wb.active
    ws.title = SCOPE_LABEL.get(scope, "البيانات")[:31]
    ws.sheet_view.rightToLeft = True  # ورقة بتخطيط من اليمين إلى اليسار

    # ترويسة التقرير
    ws.append([settings.event_name])
    ws["A1"].font = TITLE_FONT
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(HEADERS))
    ws["A1"].alignment = Alignment(horizontal="center", vertical="center")

    subtitle = (
        f"{SCOPE_LABEL.get(scope, 'البيانات')} • "
        f"العدد: {len(people)} • "
        f"تاريخ التصدير: {format_local(datetime.utcnow(), '%Y-%m-%d %H:%M')}"
    )
    ws.append([subtitle])
    ws["A2"].font = Font(size=10, color="666666")
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=len(HEADERS))
    ws["A2"].alignment = Alignment(horizontal="center", vertical="center")

    ws.append([])
    header_row = 4
    ws.append(HEADERS)

    for col in range(1, len(HEADERS) + 1):
        cell = ws.cell(row=header_row, column=col)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = BORDER

    for index, person in enumerate(people, start=1):
        local_dt = to_local(person.confirmed_at)
        ws.append([
            index,
            person.name,
            person.phone,
            "تم التأكيد" if person.attendance_confirmed else "لم يؤكد",
            local_dt.strftime("%Y-%m-%d") if local_dt else "",
            local_dt.strftime("%H:%M") if local_dt else "",
            person.admin_note or "",
        ])
        row = ws.max_row
        fill = CONFIRMED_FILL if person.attendance_confirmed else PENDING_FILL
        for col in range(1, len(HEADERS) + 1):
            cell = ws.cell(row=row, column=col)
            cell.border = BORDER
            cell.fill = fill
            if col in (1, 3, 4, 5, 6):
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="right", vertical="center", wrap_text=True)
        # إبقاء رقم الهاتف نصاً حتى لا يفقد الصفر البادئ
        ws.cell(row=row, column=3).number_format = "@"

    widths = [6, 34, 18, 14, 14, 11, 40]
    for i, width in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = width

    ws.row_dimensions[1].height = 26
    ws.freeze_panes = ws.cell(row=header_row + 1, column=1)

    if people:
        ref = f"A{header_row}:{get_column_letter(len(HEADERS))}{ws.max_row}"
        table = Table(displayName="AttendanceTable", ref=ref)
        table.tableStyleInfo = TableStyleInfo(
            name="TableStyleLight1", showRowStripes=False, showColumnStripes=False
        )
        ws.add_table(table)

    # ورقة ملخص
    summary = wb.create_sheet("الملخص")
    summary.sheet_view.rightToLeft = True
    confirmed = sum(1 for p in people if p.attendance_confirmed)
    total = len(people)
    percentage = round(confirmed / total * 100, 2) if total else 0.0
    summary_rows = [
        ("الفعالية", settings.event_name),
        ("المكان", settings.event_place),
        ("نطاق التصدير", SCOPE_LABEL.get(scope, scope)),
        ("إجمالي السجلات في الملف", total),
        ("عدد المؤكدين", confirmed),
        ("عدد غير المؤكدين", total - confirmed),
        ("نسبة التأكيد", f"{percentage}%"),
        ("تاريخ التصدير", format_local(datetime.utcnow(), "%Y-%m-%d %H:%M")),
    ]
    for label, value in summary_rows:
        summary.append([label, value])
    for row in summary.iter_rows(min_row=1, max_row=summary.max_row, max_col=2):
        row[0].font = Font(bold=True)
        for cell in row:
            cell.alignment = Alignment(horizontal="right", vertical="center")
            cell.border = BORDER
    summary.column_dimensions["A"].width = 28
    summary.column_dimensions["B"].width = 46

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    stamp = format_local(datetime.utcnow(), "%Y-%m-%d_%H-%M")
    filename = f"attendance_{scope}_{stamp}.xlsx"
    return buffer.getvalue(), filename


def build_template_workbook() -> tuple[bytes, str]:
    """إنشاء قالب Excel جاهز للأدمن لتعبئة المقبولين"""
    wb = Workbook()
    ws = wb.active
    ws.title = "المقبولون"
    ws.sheet_view.rightToLeft = True

    ws.append(["الاسم", "رقم الهاتف"])
    for col in (1, 2):
        cell = ws.cell(row=1, column=col)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center")

    samples = [
        ("أحمد محمد علي", "07701234567"),
        ("علي حسن كريم", "07801234567"),
        ("محمد أحمد سالم", "07712345678"),
    ]
    for name, phone in samples:
        ws.append([name, phone])
        ws.cell(row=ws.max_row, column=2).number_format = "@"

    ws.column_dimensions["A"].width = 34
    ws.column_dimensions["B"].width = 20
    ws.freeze_panes = "A2"

    notes = wb.create_sheet("تعليمات")
    notes.sheet_view.rightToLeft = True
    for line in [
        "طريقة تعبئة الملف:",
        "١) الصف الأول يجب أن يحتوي على العناوين: الاسم | رقم الهاتف",
        "٢) اكتب الاسم الكامل كما سيدخله الشخص عند تأكيد الحضور.",
        "٣) رقم الهاتف بصيغة 07XXXXXXXXX (يقبل النظام أيضاً +964 و 00964).",
        "٤) يُفضّل تنسيق عمود الهاتف كنص حتى لا يُحذف الصفر البادئ.",
        "٥) لا تكرر رقم الهاتف نفسه لأكثر من شخص - الرقم هو المعرّف الفريد.",
        "٦) الصفوف الفارغة تُتجاهل تلقائياً.",
    ]:
        notes.append([line])
    notes.column_dimensions["A"].width = 90

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer.getvalue(), "attendance_template.xlsx"

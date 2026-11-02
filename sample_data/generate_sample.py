"""
إنشاء ملف Excel تجريبي لاختبار النظام.
التشغيل:  python sample_data/generate_sample.py
"""
import random
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

FIRST = ["أحمد", "علي", "محمد", "حسين", "مصطفى", "كرار", "زيد", "عمر", "يوسف", "حيدر",
         "زينب", "فاطمة", "سارة", "نور", "مريم", "رقية", "هدى", "دعاء", "آية", "رند"]
MIDDLE = ["محمد", "حسن", "كريم", "جبار", "عبد الله", "صادق", "ناصر", "سالم", "قاسم", "رحيم"]
LAST = ["علي", "الجبوري", "العبيدي", "الساعدي", "التميمي", "الخفاجي", "الربيعي", "الزبيدي",
        "الدليمي", "الحسناوي"]
PREFIXES = ["077", "078", "079", "075", "076"]


def build(path: Path, count: int = 60) -> None:
    random.seed(20260819)

    wb = Workbook()
    ws = wb.active
    ws.title = "المقبولون"
    ws.sheet_view.rightToLeft = True

    ws.append(["الاسم", "رقم الهاتف"])
    for col in ("A1", "B1"):
        ws[col].fill = PatternFill("solid", fgColor="0F5132")
        ws[col].font = Font(bold=True, color="FFFFFF")
        ws[col].alignment = Alignment(horizontal="center")

    used: set[str] = set()
    while len(used) < count:
        phone = random.choice(PREFIXES) + "".join(random.choice("0123456789") for _ in range(8))
        if phone in used:
            continue
        used.add(phone)
        name = f"{random.choice(FIRST)} {random.choice(MIDDLE)} {random.choice(LAST)}"
        ws.append([name, phone])
        ws.cell(row=ws.max_row, column=2).number_format = "@"

    ws.column_dimensions["A"].width = 34
    ws.column_dimensions["B"].width = 20
    ws.freeze_panes = "A2"

    path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(path)
    print(f"تم إنشاء الملف: {path}  ({count} شخصاً)")


if __name__ == "__main__":
    build(Path(__file__).parent / "sample_people.xlsx")

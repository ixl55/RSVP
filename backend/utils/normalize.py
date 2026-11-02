"""أدوات تنظيف وتوحيد الأسماء وأرقام الهواتف العربية/العراقية"""
import re
import unicodedata

# الأرقام العربية-الهندية والفارسية -> أرقام لاتينية
_DIGIT_MAP = {ord(c): str(i) for i, c in enumerate("٠١٢٣٤٥٦٧٨٩")}
_DIGIT_MAP.update({ord(c): str(i) for i, c in enumerate("۰۱۲۳۴۵۶۷۸۹")})

# التشكيل والتطويل
_TASHKEEL = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]")
# رموز التحكم في الاتجاه (RTL/LTR marks) التي تلتصق أحياناً ببيانات Excel
_BIDI = re.compile(r"[\u200e\u200f\u202a-\u202e\u2066-\u2069\u200b-\u200d\ufeff]")


def to_latin_digits(value: str) -> str:
    """تحويل الأرقام العربية-الهندية إلى أرقام لاتينية"""
    return (value or "").translate(_DIGIT_MAP)


def clean_text(value) -> str:
    """تنظيف نص عام: إزالة الفراغات الزائدة ورموز الاتجاه"""
    if value is None:
        return ""
    text = str(value)
    text = unicodedata.normalize("NFKC", text)
    text = _BIDI.sub("", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def normalize_name(value) -> str:
    """
    توحيد الاسم لغرض المطابقة فقط (لا يُعرض للمستخدم):
    - إزالة التشكيل والتطويل
    - توحيد الألفات والهمزات والتاء المربوطة والألف المقصورة
    - توحيد المسافات وتحويل الحروف اللاتينية إلى أحرف صغيرة
    """
    text = clean_text(value)
    if not text:
        return ""
    text = _TASHKEEL.sub("", text)
    replacements = {
        "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا",
        "ة": "ه",
        "ى": "ي", "ئ": "ي",
        "ؤ": "و",
        "ﻻ": "لا", "ﻷ": "لا", "ﻹ": "لا", "ﻵ": "لا",
    }
    for src, dst in replacements.items():
        text = text.replace(src, dst)
    text = to_latin_digits(text)
    # إزالة كل ما ليس حرفاً أو رقماً أو مسافة (نقاط، شرطات، أقواس...)
    text = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)
    text = re.sub(r"\s+", " ", text).strip().lower()
    return text


def normalize_phone(value) -> str:
    """
    توحيد رقم الهاتف العراقي إلى الصيغة المحلية: 07XXXXXXXXX (11 رقماً).
    يتعامل مع: +964, 00964, 964, المسافات، الشرطات، الأقواس، الأرقام العربية،
    والأرقام التي فقدت الصفر البادئ بسبب تنسيق Excel كرقم.
    تُرجع سلسلة فارغة إذا تعذّر الوصول لرقم صالح.
    """
    text = clean_text(value)
    if not text:
        return ""

    # أرقام Excel قد تصل بصيغة 7712345678.0
    text = re.sub(r"\.0+$", "", text)
    text = to_latin_digits(text)

    has_plus = text.strip().startswith("+")
    digits = re.sub(r"\D", "", text)
    if not digits:
        return ""

    # إزالة رمز الدولة بأشكاله المختلفة
    if digits.startswith("00964"):
        digits = digits[5:]
    elif has_plus and digits.startswith("964"):
        digits = digits[3:]
    elif digits.startswith("964") and len(digits) >= 13:
        digits = digits[3:]

    digits = digits.lstrip("0")

    # الموبايل العراقي: 7 ثم 9 أرقام => 10 أرقام بدون الصفر
    if len(digits) == 10 and digits.startswith("7"):
        return "0" + digits

    # أرقام أخرى (أرضي أو دولي) نُعيدها كما هي بعد التنظيف
    return digits


def phone_is_valid(normalized: str) -> bool:
    """رقم موبايل عراقي صالح: 07 متبوعاً بـ 9 أرقام"""
    return bool(re.fullmatch(r"07\d{9}", normalized or ""))

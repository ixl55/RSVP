@echo off
chcp 65001 >nul
title نظام تأكيد الحضور - الخادم
cd /d "%~dp0backend"

if not exist ".env" (
    echo [1/3] انشاء ملف الاعدادات .env من القالب...
    copy ".env.example" ".env" >nul
)

if not exist ".venv" (
    echo [2/3] انشاء البيئة الافتراضية وتنصيب المكتبات...
    python -m venv .venv
    call ".venv\Scripts\activate.bat"
    python -m pip install --upgrade pip
    pip install -r requirements.txt
) else (
    call ".venv\Scripts\activate.bat"
)

echo [3/3] تشغيل الخادم على العنوان: http://127.0.0.1:8000
echo.
python -m uvicorn main:app --host 0.0.0.0 --port 8000
pause

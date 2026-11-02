@echo off
chcp 65001 >nul
title نظام تأكيد الحضور - الواجهة
cd /d "%~dp0frontend"

if not exist "node_modules" (
    echo تنصيب حزم الواجهة...
    call npm install
)

echo تشغيل الواجهة على العنوان: http://localhost:5173
echo.
call npm run dev
pause

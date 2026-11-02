@echo off
chcp 65001 >nul
title بناء الواجهة للنشر
cd /d "%~dp0frontend"

if not exist "node_modules" (
    call npm install
)

call npm run build

echo.
echo تم بناء الواجهة في المجلد frontend\dist
echo شغّل الخادم الآن عبر start-backend.bat وافتح http://127.0.0.1:8000
pause

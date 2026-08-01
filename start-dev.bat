@echo off
setlocal
cd /d "%~dp0"
echo ============================================
echo   Finance Manager - ishga tushirish
echo ============================================
echo.

echo [1/4] Docker Desktop holatini tekshirish...
docker info >nul 2>&1
if errorlevel 1 (
    echo.
    echo   [!] Docker Desktop ishlamayapti.
    echo       Docker Desktop'ni oching va "Engine running" deganini kuting,
    echo       keyin bu faylni QAYTA ishga tushiring.
    echo.
    pause
    exit /b 1
)
echo       OK - Docker ishlayapti.
echo.

echo [2/4] PostgreSQL va Redis konteynerlarini ishga tushirish...
docker compose up -d postgres redis
if errorlevel 1 (
    echo       Eski buyruq bilan urinamiz...
    docker-compose up -d postgres redis
)
echo.

echo [3/4] Konteynerlar holati:
docker compose ps
echo.

echo [4/4] App ishga tushmoqda (to'xtatish uchun Ctrl+C bosing)...
echo.
npm run dev

echo.
pause

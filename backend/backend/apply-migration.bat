@echo off
chcp 65001 >nul
echo ========================================
echo   Безопасное применение миграции БД
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] Проверяю статус миграций...
call npx prisma migrate status
echo.

echo [2/3] Применяю миграцию (безопасно, данные не будут потеряны)...
call npx prisma migrate deploy
if errorlevel 1 (
    echo.
    echo ОШИБКА: Не удалось применить миграцию!
    pause
    exit /b 1
)
echo.

echo [3/3] Генерирую Prisma клиент...
call npx prisma generate
if errorlevel 1 (
    echo.
    echo ОШИБКА: Не удалось сгенерировать Prisma клиент!
    pause
    exit /b 1
)
echo.

echo ========================================
echo   Миграция успешно применена!
echo ========================================
echo.
echo Теперь можно перезапустить сервер.
echo.
pause






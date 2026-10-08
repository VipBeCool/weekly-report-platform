@echo off
cd /d "%~dp0"
echo ========================================================
echo        Rebuilding Weekly Report Production Bundle
echo ========================================================
echo.
call npm run build
echo.
echo ========================================================
echo [OK] Build Complete! You can now run start.bat.
echo ========================================================
pause

@echo off
cd /d "%~dp0"
echo ========================================================
echo        Rebuilding Weekly Report Production Bundle
echo ========================================================
echo [1/2] Stopping running service to unlock files...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>nul
)
taskkill /F /T /IM node.exe >nul 2>nul
timeout /t 1 /nobreak >nul

echo [2/2] Compiling new production build...
call npm run build
echo.
echo ========================================================
echo [OK] Build Complete! You can now run start.bat.
echo ========================================================
pause

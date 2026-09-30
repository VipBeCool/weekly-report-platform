@echo off
cd /d "%~dp0"
echo Stopping Weekly Report Service...

:: 1. 尝试按 3000 端口释放
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>nul
)

:: 2. 彻底保险：杀死所有残留的 node.exe 进程
taskkill /F /T /IM node.exe >nul 2>nul

echo [OK] Done. Port 3000 is completely released.
pause

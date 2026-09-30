@echo off
cd /d "%~dp0"

echo [0/3] Clearing old process on port 3000 if occupied...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>nul
)
taskkill /F /T /IM node.exe >nul 2>nul
timeout /t 1 /nobreak >nul

echo [1/3] Checking dependencies...
call npm install --registry=https://registry.npmmirror.com
echo.
echo [2/3] Checking build...
call npm run build
echo.
echo ========================================================
echo         Weekly Report Server is Starting!
echo ========================================================
node -e "const os=require('os'),nets=os.networkInterfaces();for(const n in nets){for(const net of nets[n]){if(net.family==='IPv4'&&!net.internal){console.log(' Team URL :  http://' + net.address + ':3000');}}};console.log(' Local URL : http://localhost:3000');"
echo ========================================================
echo.
call npm run start
pause

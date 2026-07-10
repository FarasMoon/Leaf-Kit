@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Starting LeafKit...
echo.

REM Kill any existing process on port 6299
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":6299" ^| findstr "LISTENING"') do (
    echo Killing old process on port 6299: PID %%a
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

node server.cjs
pause

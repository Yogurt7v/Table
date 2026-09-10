@echo off
cd /d "%~dp0"
echo Stopping PocketBase...

:: Способ 1: По PID файлу
if exist pocketbase.pid (
    set /p PID=<pocketbase.pid
    taskkill /F /PID %PID% >nul 2>&1
    if %errorlevel%==0 (
        echo Stopped by PID: %PID%
        del pocketbase.pid
        pause
        exit /b 0
    )
)

:: Способ 2: По имени процесса (если PID не сработал)
taskkill /F /IM pocketbase.exe >nul 2>&1
if %errorlevel%==0 (
    echo Stopped by process name
    if exist pocketbase.pid del pocketbase.pid
    pause
    exit /b 0
)

:: Способ 3: По порту (запасной вариант)
for /f "tokens=5" %%a in ('netstat -ano ^| find ":8090" ^| find "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
    if !errorlevel!==0 echo Stopped process on port 8090 (PID: %%a)
)

echo PocketBase is not running or already stopped.
pause

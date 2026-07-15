@echo off
setlocal
cd /d "D:\Repo\silence-cutter"

if not exist "node_modules\" (
    echo [QuietCut] Installing dependencies...
    call npm install
    if %ERRORLEVEL% neq 0 goto :fail
)

if not exist "node_modules\electron\dist\electron.exe" (
    echo [QuietCut] Installing Electron...
    node node_modules\electron\install.js
    if %ERRORLEVEL% neq 0 goto :fail
)

echo [QuietCut] Building...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo [QuietCut] Build failed. Trying again with fresh install...
    call npm install
    if %ERRORLEVEL% neq 0 goto :fail
    call npm run build
    if %ERRORLEVEL% neq 0 goto :fail
)

echo [QuietCut] Launching...
call npx electron .
if %ERRORLEVEL% neq 0 goto :fail
exit /b 0

:fail
echo.
echo [QuietCut] Launch failed (error %ERRORLEVEL%).
pause >nul
exit /b %ERRORLEVEL%

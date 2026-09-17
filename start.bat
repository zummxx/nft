@echo off
chcp 65001 >nul
echo [NFT SeaDrop Sniper] Checking Node.js environment...

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo ================================================================
    echo [Notice] Node.js is not installed on this Windows VM.
    echo Opening the official Node.js download page for you...
    echo ================================================================
    echo.
    start https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi
    echo Please install Node.js (just click Next until finished),
    echo then double-click this start.bat again!
    echo.
    pause
    exit /b
)

echo [OK] Node.js detected!
echo.
echo [1/2] Checking dependencies...
if not exist node_modules (
    echo Installing dependencies, please wait...
    call npm install
)

echo.
echo [2/2] Launching SeaDrop Sniper...
start http://localhost:3000
call npm run dev
pause

@echo off
chcp 65001 >nul
echo [NFT SeaDrop Sniper] Packaging Windows EXE...

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo ================================================================
    echo [Notice] Node.js is required to package the EXE.
    echo Opening official Node.js installer download page...
    echo ================================================================
    echo.
    start https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi
    echo Please install Node.js, then re-run build_exe.bat!
    echo.
    pause
    exit /b
)

echo [OK] Node.js detected!
echo.
echo [1/2] Installing dependencies...
call npm install

echo.
echo [2/2] Building Windows standalone application...
call npm run package:win

echo.
echo ================================================================
echo Build finished!
echo Check folder: release\NFTPublicMintSniper-win32-x64
echo Double click NFTPublicMintSniper.exe to run!
echo ================================================================
pause

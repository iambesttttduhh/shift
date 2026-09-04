@echo off
title frfr. — make frens in ur city
cd /d "%~dp0"
echo.
echo   ============================================
echo     frfr. is starting... keep this window open
echo     then open  http://localhost:3000  in Chrome
echo     (to stop the app: close this window)
echo   ============================================
echo.
node server.js
pause

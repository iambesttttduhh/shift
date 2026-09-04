@echo off
title frfr. — make frens in ur city
cd /d "%~dp0"
echo.
echo   ============================================
echo     frfr. is starting... keep this window open
echo     then open  http://localhost:3000  in Chrome
echo     (to stop the app: close this window)
echo     (updates itself automatically on start!)
echo   ============================================
echo.
:loop
node server.js
if errorlevel 99 (
  echo.
  echo   ~~~~ updated! starting the new version ~~~~
  echo.
  goto loop
)
pause

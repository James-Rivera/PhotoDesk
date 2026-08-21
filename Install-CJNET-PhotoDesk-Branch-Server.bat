@echo off
setlocal
cd /d "%~dp0"
title CJNET PhotoDesk Branch Server Setup
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-branch-server.ps1"
if errorlevel 1 (
  echo.
  echo Setup did not finish. Read the error above, then try again.
) else (
  echo.
  echo Setup finished successfully.
)
pause

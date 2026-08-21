@echo off
setlocal
cd /d "%~dp0"
title Remove CJNET PhotoDesk Branch Server
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\uninstall-branch-server.ps1"
pause

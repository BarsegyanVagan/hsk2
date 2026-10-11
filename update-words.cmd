@echo off
rem Rebuild data\words.json from hsk_2_1_15.txt and refresh stroke-order data (just double-click this file)
chcp 65001 >nul
powershell -NoProfile -Command "Unblock-File -LiteralPath '%~dp0scripts\convert.ps1','%~dp0scripts\fetch-strokes.ps1'"
powershell -NoProfile -ExecutionPolicy RemoteSigned -File "%~dp0scripts\convert.ps1" %*
if errorlevel 1 goto end
echo.
powershell -NoProfile -ExecutionPolicy RemoteSigned -File "%~dp0scripts\fetch-strokes.ps1"
:end
echo.
pause

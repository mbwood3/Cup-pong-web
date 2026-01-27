@echo off
cd /d "%~dp0"
set "GAME=%~dp0game.html"

if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" "%GAME%" & exit /b
)
if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
  "C:\Program Files\Microsoft\Edge\Application\msedge.exe" "%GAME%" & exit /b
)
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
  "C:\Program Files\Google\Chrome\Application\chrome.exe" "%GAME%" & exit /b
)
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
  "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" "%GAME%" & exit /b
)

start "" "%GAME%"

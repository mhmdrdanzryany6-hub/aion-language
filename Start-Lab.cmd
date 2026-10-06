@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    set "PATH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
  ) else (
  echo Install Node.js 24 or newer, then run this file again.
  pause
  exit /b 1
  )
)
start "AION Lab" http://127.0.0.1:4173
node serve.mjs
pause

@echo off
REM ============================================================
REM  NEON BEAT - Quick Launch
REM  Runs the pre-built release executable directly.
REM  This is the fastest way to play.
REM
REM  If neon-beat.exe does not exist yet, run REBUILD.bat first.
REM ============================================================
setlocal
set "EXE=%~dp0src-tauri\target\release\neon-beat.exe"

if not exist "%EXE%" (
  echo.
  echo  [!] neon-beat.exe not found at:
  echo      %EXE%
  echo.
  echo  Please run REBUILD.bat first to build the release binary.
  echo.
  pause
  exit /b 1
)

echo Launching NEON BEAT ...
start "" "%EXE%"
endlocal

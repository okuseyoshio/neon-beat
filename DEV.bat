@echo off
REM ============================================================
REM  NEON BEAT - Dev Mode
REM  Starts Vite + Tauri dev with hot reload.
REM  Use this when you are editing source code and want to see
REM  changes instantly without rebuilding the .exe.
REM
REM  Close the Tauri window to stop the dev server.
REM ============================================================
cd /d "%~dp0"
echo Starting Tauri dev (hot reload enabled) ...
echo This may take a moment on first launch.
echo.
call npm run tauri:dev
echo.
echo Dev session ended.
pause

@echo off
REM ============================================================
REM  NEON BEAT - Production Rebuild
REM  Recompiles the release executable and the NSIS installer.
REM
REM  - Output exe:       src-tauri\target\release\neon-beat.exe
REM  - Output installer: src-tauri\target\release\bundle\nsis\
REM
REM  First build: 5 - 10 minutes.
REM  Subsequent builds: 1 - 3 minutes (Cargo cache).
REM ============================================================
cd /d "%~dp0"
echo Rebuilding NEON BEAT release binary + installer ...
echo This may take several minutes. Please wait.
echo.
call npm run tauri:build
echo.
echo ============================================================
echo Build finished. Output locations:
echo   exe:       src-tauri\target\release\neon-beat.exe
echo   installer: src-tauri\target\release\bundle\nsis\
echo ============================================================
pause

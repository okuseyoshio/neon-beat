@echo off
REM ============================================================
REM  NEON BEAT - Import WAV Songs
REM
REM  TWO WAYS TO USE THIS:
REM
REM  1. DRAG AND DROP (recommended)
REM     Drop one or more .wav files directly onto this bat file.
REM     They will be copied into import\ and analyzed automatically.
REM
REM  2. DOUBLE-CLICK
REM     Opens the import\ folder so you can drop files manually,
REM     then press any key to analyze them.
REM
REM  After analysis, the songs appear in NEON BEAT immediately.
REM  No need to restart the game if it's running.
REM ============================================================
setlocal EnableDelayedExpansion
cd /d "%~dp0"

if not exist "import" mkdir import

if not "%~1"=="" goto handle_drop

REM ----- No files dropped: open import folder and wait -----
echo No files were dropped on this bat.
echo.
echo Opening the import\ folder.
echo Drop your .wav files there, then come back to this window
echo and press any key to start analysis.
echo.
start "" "import"
pause
goto run_import

:handle_drop
echo Copying dropped files into import\ ...
echo.
:copy_loop
if "%~1"=="" goto copy_done
echo   - %~nx1
copy /Y "%~1" "import\" >nul
shift
goto copy_loop
:copy_done
echo.

:run_import
echo ============================================================
echo Running batch_import.py ...
echo ============================================================
python tools\batch_import.py
set "RC=%ERRORLEVEL%"
echo ============================================================
if not "%RC%"=="0" (
  echo.
  echo  [!] batch_import.py exited with code %RC%.
  echo      Make sure Python and the librosa requirements are installed:
  echo        pip install -r tools\requirements.txt
)
echo.
echo Done. Press any key to close.
pause
endlocal

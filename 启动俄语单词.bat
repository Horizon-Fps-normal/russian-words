@echo off
rem Russian Words desktop app launcher (double-click to start)
cd /d "%~dp0"
echo Starting Russian Words desktop app...
call npm run desktop:dev
pause

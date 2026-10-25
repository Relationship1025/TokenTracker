@echo off
setlocal
cd /d "%~dp0"

rem One-click launcher for the web dashboard (Vite dev server, mock API).
rem Double-click this file: it starts the server in a minimized window,
rem waits for the port, then opens the dashboard in the default browser.

set "PORT=5173"
set "URL=http://localhost:%PORT%/dashboard"

rem If something is already listening on the port, just open the browser.
rem Use "localhost" (not 127.0.0.1): Vite binds ::1 first on Windows. The
rem TcpClient(host,port) ctor form is required — the no-arg ctor + Connect()
rem holds an IPv4-only socket and fails when ::1 answers first (PS 5.1).
powershell -NoProfile -Command "try { (New-Object Net.Sockets.TcpClient('localhost',%PORT%)).Close(); exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel%==0 (
    echo Port %PORT% is already in use - opening %URL% directly.
    start "" "%URL%"
    timeout /t 2 >nul
    exit /b 0
)

echo Starting TokenTracker dashboard dev server on port %PORT% ...
start "TokenTracker Dashboard (dev server)" /min cmd /k npm run dashboard:dev

set /a tries=0
:wait_loop
timeout /t 1 /nobreak >nul
powershell -NoProfile -Command "try { (New-Object Net.Sockets.TcpClient('localhost',%PORT%)).Close(); exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel%==0 goto server_up
set /a tries+=1
if %tries% lss 40 goto wait_loop

echo.
echo ERROR: dev server did not come up within 40 seconds.
echo Check the minimized "TokenTracker Dashboard (dev server)" window for the error.
pause
exit /b 1

:server_up
echo Server is up. Opening %URL% ...
start "" "%URL%"
echo.
echo   Dashboard: %URL%
echo   To stop:   close the minimized "TokenTracker Dashboard (dev server)" window.
echo.
echo This launcher window will close in a few seconds.
timeout /t 5 >nul
exit /b 0

@echo off
setlocal

cd /d "%~dp0"

if /i "%~1"=="--help" goto :help

set "NPM_CMD="
if exist "C:\nvm4w\nodejs\npm.cmd" set "NPM_CMD=C:\nvm4w\nodejs\npm.cmd"
if not defined NPM_CMD for %%I in (npm.cmd) do set "NPM_CMD=%%~$PATH:I"

if not defined NPM_CMD (
  echo [JW Modbus Tool] Could not find npm.cmd.
  echo Install Node.js or add npm.cmd to PATH.
  goto :error
)

set "NEED_INSTALL="
if not exist "node_modules\.bin\electron-builder.cmd" set "NEED_INSTALL=1"
if not exist "node_modules\electron\dist\electron.exe" set "NEED_INSTALL=1"

if defined NEED_INSTALL (
  echo [JW Modbus Tool] Installing dependencies...
  "%NPM_CMD%" install
  if errorlevel 1 (
    echo [JW Modbus Tool] npm install failed.
    goto :error
  )
)

echo.
echo [JW Modbus Tool] Building Windows x64 portable...
echo Close the development app first if Windows reports locked files.
echo.

"%NPM_CMD%" run build:portable
if errorlevel 1 goto :error

echo.
echo [JW Modbus Tool] Portable ready in:
echo "%CD%\release"
echo.
pause
exit /b 0

:help
echo Usage: build-portable.bat
echo Builds the Windows x64 portable executable in the release folder.
exit /b 0

:error
echo.
echo [JW Modbus Tool] Portable build failed.
pause
exit /b 1

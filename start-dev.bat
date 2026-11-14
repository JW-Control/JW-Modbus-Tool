@echo off
setlocal

cd /d "%~dp0"

set "NPM_CMD="
if exist "C:\nvm4w\nodejs\npm.cmd" set "NPM_CMD=C:\nvm4w\nodejs\npm.cmd"
if not defined NPM_CMD for %%I in (npm.cmd) do set "NPM_CMD=%%~$PATH:I"

if not defined NPM_CMD (
  echo Could not find npm.cmd. Install Node.js or add npm.cmd to PATH.
  pause
  exit /b 1
)

set "NEED_INSTALL="
if not exist "node_modules\.bin\electron.cmd" set "NEED_INSTALL=1"
if not exist "node_modules\electron\dist\electron.exe" set "NEED_INSTALL=1"

if defined NEED_INSTALL (
  echo Installing dependencies...
  rem "call" is required: running a .cmd from a .bat without it never returns.
  call "%NPM_CMD%" install
  if errorlevel 1 (
    echo npm install failed.
    echo If Electron files are locked, close Codex/VS Code windows that use this project and try again.
    pause
    exit /b 1
  )
)

rem npm reports "up to date" without re-downloading Electron when its binary is missing.
if not exist "node_modules\electron\dist\electron.exe" (
  echo Downloading the Electron binary...
  node node_modules\electron\install.js
  if errorlevel 1 (
    echo Electron download failed. Check the internet connection and try again.
    pause
    exit /b 1
  )
)

node scripts\dev-runner.mjs
if errorlevel 1 (
  echo JW Modbus Tool failed to start.
  pause
  exit /b 1
)

endlocal

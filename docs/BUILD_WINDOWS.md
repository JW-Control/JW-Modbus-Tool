# Build Windows

JW Modbus Tool is Windows-first. The x64 portable build is validated with the
native `serialport` binding rebuilt for Electron 43.

## Requirements

- Node.js 22 or newer.
- npm.
- Windows development machine.

## Install

```powershell
npm install
```

## Test and type-check

```powershell
npm test
npm run typecheck
```

## Build renderer and Electron main

```powershell
npm run build
```

## Run Electron in development

Fast Windows startup:

```powershell
.\start-dev.bat
```

Equivalent npm script:

```powershell
npm run dev:electron
```

The startup runner starts Vite, waits for `http://127.0.0.1:5173`, opens
Electron, and stops Vite when Electron exits. Serial COM access is available only
in the Electron window, not in browser preview.

## Build portable executable

```powershell
.\build-portable.bat
```

This is the recommended double-click workflow. It locates `npm.cmd`, installs
missing dependencies when required, runs the production build, and pauses with
the final result. Close the development Electron window first if Windows
reports locked files.

Equivalent npm command:

```powershell
npm run build:portable
```

Expected product name:

`release\JW Modbus Tool-0.1.0-x64.exe`

The portable build uses the Electron distribution already installed in
`node_modules`. This avoids a Windows directory-lock issue observed while
Electron Builder renamed a freshly downloaded extraction.

Vite uses a relative asset base so the packaged renderer resolves JavaScript
and CSS correctly through Electron's `file://` loader.

The executable is currently unsigned. Windows SmartScreen may show an
unrecognized publisher warning during local testing.

## Portable smoke test

1. Close the development Electron window so it releases the COM port.
2. Run `release\JW Modbus Tool-0.1.0-x64.exe`.
3. Confirm that the COM list loads.
4. Connect to the JWPLC at 115200 8N1.
5. Run FC1 or the JWPLC validation sequence.
6. Confirm TX/RX data and `CRC OK` in Bus Monitor.

## Build installer

```powershell
npm run build:installer
```

Installer signing and public release packaging remain deferred.

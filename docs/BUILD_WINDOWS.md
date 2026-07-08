# Build Windows

JW Modbus Tool is Windows-first. Portable and installer scripts are scaffolded,
but packaging must be revalidated after serial integration is added.

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
npm run build:portable
```

Expected product name:

`JW Modbus Tool.exe`

## Build installer

```powershell
npm run build:installer
```

Installer signing and public release packaging are outside this first step.

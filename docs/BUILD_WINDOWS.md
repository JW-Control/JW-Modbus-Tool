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

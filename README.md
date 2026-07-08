# JW Modbus Tool

JW Modbus Tool is a clean-room, MIT-licensed desktop tool by JW Control for
Modbus RTU testing, diagnostics, and demonstrations on Windows. The first target
hardware profile is JWPLC Basic Remote I/O over Modbus RTU.

## MVP 0.1 status

This repository is in the first implementation step. It currently includes:

- Electron, TypeScript, React, and Vite project skeleton.
- Secure Electron defaults: `contextIsolation: true` and `nodeIntegration: false`.
- Shared Modbus RTU engine foundations.
- CRC16/Modbus implementation.
- RTU frame build/parse utilities.
- Master request encoders for FC1, FC2, FC3, FC4, FC5, FC6, FC15, and FC16.
- Slave simulator response core for FC1, FC2, FC3, FC4, FC5, FC6, FC15, and FC16.
- Minimal tests for CRC, frame construction, exception responses, and slave behavior.
- Base documentation and third-party policy.

The full dashboard UI, serial integration, persistence, log export, and Windows
packaging validation are intentionally deferred until this foundation compiles
and tests pass.

## Install dependencies

```powershell
npm install
```

## Run tests

```powershell
npm test
```

## Type-check and compile

```powershell
npm run typecheck
npm run build
```

## Run in development

Renderer-only Vite development:

```powershell
npm run dev
```

Electron development is scaffolded and will be expanded with the serial layer:

```powershell
npm run dev:electron
```

## Windows packaging scripts

Portable build:

```powershell
npm run build:portable
```

Installer build:

```powershell
npm run build:installer
```

These scripts are present so the repo shape is ready for Windows delivery. They
should be validated after the serial layer and renderer workflow are connected.

## Current scope

- Modbus RTU only.
- Clean-room TypeScript implementation.
- Windows-first desktop architecture.
- Minimal placeholder renderer while the protocol core is stabilized.

## Current limitations

- No complete UI yet.
- No serial port dependency has been added yet.
- No COM port connection flow yet.
- No local JSON persistence yet.
- No log export yet.
- No signed installer.

## Roadmap

MVP 0.1:

- RTU Master.
- RTU Slave Simulator.
- JWPLC Basic Remote I/O preset.
- Bus monitor.
- Export logs.
- Windows portable and installer builds.

MVP 0.2:

- Modbus TCP Master.
- Modbus TCP Slave.
- Float32, Int32, and endian display options.
- Multiple sessions.
- Better validation reports.

MVP 0.3:

- Import/export presets.
- JW Control device templates.
- Final app icon and visual theme.
- Advanced frame inspection.

## Licensing and third-party policy

JW Modbus Tool is developed from scratch. It does not reuse source code,
internal structure, assets, icons, screen designs, text, or internal names from
QModMaster, libmodbus, PyModbus, Modbus Poll, ModScan, or other existing Modbus
tools. Those tools may be considered only as external functional references for
common Modbus workflows.

GPL, LGPL, and AGPL code must not be copied into this project. New dependencies
must use permissive licenses compatible with MIT or be reviewed before adoption.
Document each dependency and reason in `THIRD_PARTY_NOTICES.md`.

## License

MIT. Copyright (c) 2026 JW Control.

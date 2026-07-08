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
- Serial port listing and basic connect/disconnect IPC through Electron main.
- Minimal serial diagnostics panel for development validation.
- Minimal Master RTU probe for JWPLC Basic: FC1, FC2, FC5, and FC15 with
  TX/RX monitor output.
- JWPLC validation sequence with PASS/FAIL summary.
- Minimal tests for CRC, frame construction, exception responses, and slave behavior.
- Base documentation and third-party policy.

The full dashboard UI, RTU request execution over serial, persistence, log
export, and Windows packaging validation are intentionally deferred until this
foundation compiles and tests pass.

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

Fast Windows startup:

```powershell
.\start-dev.bat
```

This starts the Vite dev server, waits for it, opens Electron, and stops the dev
server when Electron exits.

Renderer-only Vite development:

```powershell
npm run dev
```

Electron development through the one-command runner:

```powershell
npm run dev:electron
```

The serial diagnostics panel only has access to COM ports in the Electron app.
Browser preview is useful for layout checks but does not include the preload
bridge.

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
- Minimal serial diagnostics renderer while the protocol and serial layers are
  stabilized.
- COM port listing through `serialport`.
- Basic open/close serial session flow at 115200 8N1 from the diagnostics panel.

## Current limitations

- No complete UI yet.
- FC1, FC2, FC5, and FC15 are wired to the serial UI so far.
- FC3, FC4, FC6, and FC16 are implemented in the engine but not yet exposed in
  the UI.
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

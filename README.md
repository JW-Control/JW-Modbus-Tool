# JW Modbus Tool

JW Modbus Tool is a clean-room, MIT-licensed desktop tool by JW Control for
Modbus RTU testing, diagnostics, and demonstrations on Windows. The first target
hardware profile is JWPLC Basic Remote I/O over Modbus RTU.

## Estado: 0.1.0 (sin publicar)

La app abre en "Modo sencillo", con seis vistas:

- **Dispositivos**: conexión RTU (puerto, formato serial, timeout, eco del
  conversor), escaneo de IDs y lectura rápida de registros.
- **Sesiones**: guardar y abrir sesiones `.jwmodbus-session` (conexión,
  dispositivos, historial de pruebas, notas y dispositivos virtuales).
- **Pruebas**: plan de pruebas por pasos con escenarios de falla.
- **Registros**: lectura y escritura de las 8 funciones (FC1 a FC6, FC15 y
  FC16), con lectura automática.
- **Tráfico Modbus**: monitor TX/RX.
- **Simulador**: el PC responde como uno o varios slaves RTU virtuales en un
  COM, con plantilla JWPLC Basic Remote I/O y fallas configurables. El master
  de la app también lo alcanza en memoria por el puerto "Simulador interno
  (sin COM)". Guía: `docs/GUIA_USO_SIMULADOR.md`; notas técnicas:
  `docs/SLAVE_SIMULATOR.md`; hoja de ruta: `docs/HOJA_DE_RUTA_SIMULADOR.md`.

Motor compartido: CRC16, armado y lectura de tramas RTU, codificadores del
master y respuestas del slave para las 8 funciones, separador de tramas
tolerante a pausas y manejo del eco de conversores USB-RS485 ("Eco del
conversor": automático, sin eco, con eco).

Pruebas: `npm test` (unitarias y de extremo a extremo en memoria) y la
integración contra un JWPLC Basic simulado en JWPLC Sim, con y sin eco:
`docs/PRUEBAS_JWPLC_SIM.md`. Bitácora del proceso: `BITACORA_CAMBIOS.md`.

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
.\build-portable.bat
```

The BAT locates the real `npm.cmd`, installs missing dependencies when needed,
and leaves the resulting executable in `release`. The equivalent command is
`npm run build:portable`.

Installer build:

```powershell
npm run build:installer
```

The x64 portable build is validated with Electron 43 and the native serialport
binding. Installer signing remains deferred.

## Current scope

- Modbus RTU only.
- Clean-room TypeScript implementation.
- Windows-first desktop architecture.
- Base desktop renderer while the protocol and serial layers are stabilized.
- COM port listing through `serialport`.
- Configurable serial session flow for supported RTU formats.
- JWPLC Basic validation report copy/save as Markdown.
- Generic bit and register operations for all eight supported function codes.
- Save, load, update, and delete Generic Master request presets.
- Bus Monitor copy/save as Markdown.
- Virtual RTU slaves on a dedicated COM port.

## Current limitations

- Modbus RTU only: the TCP tab is disabled until 0.2.
- Register values are currently displayed as unsigned 16-bit decimal and
  hexadecimal values only.
- No file-based JSON preset import/export yet.
- The remembered serial port is selected on startup but is not opened
  automatically.
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

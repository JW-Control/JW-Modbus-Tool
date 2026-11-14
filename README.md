# JW Modbus Tool

JW Modbus Tool is a clean-room, MIT-licensed desktop tool by JW Control for
Modbus testing, diagnostics, and demonstrations on Windows: Modbus RTU and
ASCII over serial, Modbus TCP and RTU over TCP. The first target hardware
profile is JWPLC Basic Remote I/O.

## Estado: 0.2.0 (sin publicar)

La app abre en "Modo sencillo", con siete vistas:

- **Dispositivos**: conexión **Serie** (RTU o ASCII, puerto, formato serial,
  eco del conversor) o **TCP / Ethernet** (IP, puerto, Modbus TCP o RTU
  sobre TCP para pasarelas), timeout, numeración de direcciones, escaneo de
  IDs y lectura rápida.
- **Sesiones**: guardar y abrir sesiones `.jwmodbus-session` (conexión,
  ventanas de lectura, dispositivos, historial de pruebas, notas y
  dispositivos virtuales).
- **Pruebas**: plan de pruebas por pasos con escenarios de falla.
- **Registros**: varias ventanas de sondeo en paralelo (como Modbus Poll),
  cada una con su slave, función, bloque, intervalo y timeout. Formatos
  UInt16, Int16, Hex, Binario, Texto, UInt32, Int32, Float32, UInt64, Int64
  y Float64 con orden de bytes ABCD, CDAB, BADC o DCBA, también por fila.
  Doble clic en un valor para escribirlo (FC5/FC6, o FC15/FC16), alias por
  dirección, gráfica de varias direcciones y registro a CSV con fecha y hora.
- **Funciones**: identificación del equipo (FC43/14 y FC17), escritura con
  máscara (FC22), lectura y escritura en una petición (FC23) y trama escrita
  a mano en hexadecimal, con o sin CRC, LRC o cabecera MBAP.
- **Tráfico Modbus**: monitor de peticiones y respuestas.
- **Simulador**: el PC responde como uno o varios slaves virtuales por un
  COM (RTU o ASCII) y por un servidor Modbus TCP (MBAP o RTU sobre TCP), con
  plantilla JWPLC Basic Remote I/O y fallas configurables. El master de la
  app también lo alcanza en memoria por el puerto "Simulador interno (sin
  COM)". Guía: `docs/GUIA_USO_SIMULADOR.md`; notas técnicas:
  `docs/SLAVE_SIMULATOR.md`; hoja de ruta: `docs/HOJA_DE_RUTA_SIMULADOR.md`.

Numeración de direcciones (Dispositivos → Direcciones): 4xxxx desde 40000
(por defecto, como en 0.1), base 0, base 1 o Modicon desde 40001. Solo cambia
cómo se muestran y escriben; en la trama siempre viaja la dirección de
protocolo.

Motor compartido por PDU: cada transporte agrega su envoltura (unit id y CRC
en RTU, ":" + LRC + CRLF en ASCII, cabecera MBAP en TCP). Funciones FC1 a
FC6, FC15, FC16, FC17, FC22, FC23 y FC43/14 en el master y en el simulador;
separadores de tramas tolerantes a pausas; respuestas TCP emparejadas por
número de transacción; manejo del eco de conversores USB-RS485.

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

- Modbus RTU and ASCII (serial), Modbus TCP and RTU over TCP.
- Clean-room TypeScript implementation.
- Windows-first desktop architecture.
- Base desktop renderer while the protocol and serial layers are stabilized.
- COM port listing through `serialport`.
- Configurable serial session flow for supported RTU formats.
- JWPLC Basic validation report copy/save as Markdown.
- Generic bit and register operations for all eight supported function codes.
- Save, load, update, and delete Generic Master request presets.
- Bus Monitor copy/save as Markdown.
- Virtual slaves on a dedicated COM port (RTU or ASCII) and on a Modbus TCP
  server.

## Current limitations

- The simulator's memory tables always show 4xxxx numbering, whatever the
  address mode chosen for the master views.
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

MVP 0.2 (done in this branch):

- Modbus TCP Master and Slave, RTU over TCP, Modbus ASCII.
- 16/32/64-bit data formats and byte orders.
- Several polling windows, write by double click, CSV logging, multi-trace chart.
- FC17, FC22, FC23 and FC43/14; hand-typed frames.

Still open from 0.2: better validation reports.

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

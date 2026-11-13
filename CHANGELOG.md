# Changelog

All notable changes to JW Modbus Tool will be documented in this file.

## 0.2.0 - Unreleased

### Added

- Modbus TCP master (MBAP, matched by transaction id) and RTU over TCP for serial-to-Ethernet gateways.
- Modbus ASCII on serial ports, in the master and in the slave simulator.
- Simulator Modbus TCP server (MBAP or RTU over TCP, several clients at once), next to the COM port and the internal channel.
- FC17 Report Server ID, FC22 Mask Write Register, FC23 Read/Write Multiple Registers and FC43/14 Read Device Identification, in the master and in the simulator.
- Registros view rebuilt as polling windows: several blocks polled in parallel, each with its own slave, function, interval and timeout; polling keeps running in other views.
- Data formats UInt16, Int16, Hex, Binary, Text, UInt32, Int32, Float32, UInt64, Int64 and Float64, with byte orders ABCD, CDAB, BADC and DCBA, per window and per row.
- Write by double click on a value (FC5/FC6, or FC15/FC16 on request; FC16 for 32/64-bit values).
- Per-address aliases, multi-trace chart (1, 5 or 10 minutes) and CSV logging with timestamps (";" separator, "," decimals).
- Funciones view: FC43/14, FC17, FC22, FC23 and a hex frame typed by hand, with or without CRC, LRC or MBAP header.
- Address numbering: 4xxxx from 40000 (default), base 0, base 1, or Modicon from 40001.
- Sessions keep the transport, TCP settings, address mode and polling windows.

### Changed

- The Modbus engine works on PDUs; RTU, ASCII and TCP only add their own framing.
- Quantity out of range now answers exception 03 in the simulator, as the specification asks.

### Fixed

- `preload.cjs` (the file the app loads) now exposes the same IPC channels as `preload.ts`; a test keeps them in sync.

## 0.1.0 - Unreleased

### Added

- USB-RS485 converter echo handling ("Eco del conversor": Automático, Sin eco, Con eco) in the master and in the slave simulator; the simulator counts discarded echoes.
- JWPLC Sim integration: pty bridge with optional echo, master and slave test scripts, and the `Slave_JWSim_8FC` / `Master_JWSim_8FC` sketches (docs/PRUEBAS_JWPLC_SIM.md).
- `Simulador_Master_RS485.ino` for test C2 and `scripts/sim/pty-pair.py` (virtual null-modem pair) for running test A on Linux.
- Initial Electron, TypeScript, React, and Vite project skeleton.
- Clean-room Modbus RTU shared engine foundation.
- CRC16/Modbus implementation.
- RTU frame parser and builder.
- Master request encoders for FC1, FC2, FC3, FC4, FC5, FC6, FC15, and FC16.
- Slave simulator response core for FC1, FC2, FC3, FC4, FC5, FC6, FC15, and FC16.
- Serial-backed slave simulator with several virtual devices per COM port, live value editing, traffic log, and counters.
- RTU request framer that recovers from misaligned streams and foreign responses on a shared bus.
- JWPLC Basic Remote I/O template for virtual devices, matching the real firmware map.
- Per-device simulator faults: no response, corrupted CRC, forced exception (01 to 04), and response delay.
- Tests view scenarios apply their fault to the virtual devices the plan targets.
- Virtual devices and simulator serial settings saved in and restored from session files.
- Exception code 04 (Slave Device Failure) recognized by the master.
- Internal simulator channel: the master connects to "INTERNO" and talks to the virtual devices in memory, with no COM port or driver.
- Simulator traffic history (last 500 frames) kept in the main process, so it survives switching views.
- End-to-end tests that run the real master code against the real simulator over the internal channel.

- Serial port listing, validation, and basic Electron IPC open/close flow.
- Persistent serial format, timeout, and last-port settings.
- Minimal serial diagnostics panel for development.
- Serial-backed JWPLC Basic probe for FC1, FC2, FC5, and FC15.
- JWPLC Basic validation sequence with PASS/FAIL summary.
- Base application views for Dashboard, JWPLC Preset, Generic Master, Bus Monitor, and Settings.
- Clipboard copy and Markdown save flow for JWPLC validation reports.
- Serial-backed Generic Master operations for FC1, FC2, FC3, FC4, FC5, FC6, FC15, and FC16.
- Locally persisted Generic Master request presets.
- Validated Windows x64 portable packaging with the native serialport binding.
- Relative renderer asset paths for packaged `file://` loading.
- Clipboard copy and Markdown save flow for Bus Monitor captures.
- Spanish application interface with compact responsive navigation and Lucide icons.
- Safety confirmations before Modbus write operations and the JWPLC validation sequence.
- Professional dark workspace shell with command bar, side navigation, persistent serial strip, and status bar.
- One-click Windows portable build launcher.
- Documented final interface concept and deferred product scope.
- JWPLC Basic Remote I/O preset data scaffold.
- Base docs, build notes, and legal clean-room policy.

### Fixed

- Registros: the "Tendencia (últimos 60 s)" chart was a static drawing and its min/max/average used every row in the table; it now plots and summarizes the selected register's real reads. Each read keeps the selected register instead of jumping back to the first one.
- The slave simulator waits up to 150 ms for the rest of a request that pauses in mid-frame instead of dropping it after 20 ms.
- Master reads now report a corrupted response CRC as a CRC error instead of failing to decode the frame.

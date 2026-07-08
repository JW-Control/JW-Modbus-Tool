# Serial Layer

The serial layer is intentionally small in this step. It proves that Electron
main can list COM ports, validate RTU settings, and open or close a Windows
serial port without exposing Node.js APIs to the renderer.

## Current behavior

- Lists available COM ports through `serialport`.
- Sorts Windows `COM1`, `COM2`, `COM10` naturally.
- Validates MVP baud rates: 9600, 19200, 38400, 57600, and 115200.
- Defaults to 115200 8N1 in the development diagnostics panel.
- Supports data bits 7 or 8.
- Supports parity none, even, and odd.
- Supports stop bits 1 or 2.
- Returns structured IPC results instead of throwing raw errors into renderer
  code.

## Deferred

- Read/write RTU transaction orchestration.
- Timeouts and retries around serial responses.
- Bus monitor TX/RX event capture.
- Serial-backed master and slave sessions.
- Packaging validation for native serial bindings.

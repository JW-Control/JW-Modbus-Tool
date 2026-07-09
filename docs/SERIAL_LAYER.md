# Serial Layer

The serial layer is intentionally small in this step. It proves that Electron
main can list COM ports, validate RTU settings, and open or close a Windows
serial port without exposing Node.js APIs to the renderer.

## Current behavior

- Lists available COM ports through `serialport`.
- Sorts Windows `COM1`, `COM2`, `COM10` naturally.
- Validates MVP baud rates: 9600, 19200, 38400, 57600, and 115200.
- Defaults to 115200 8N1 and exposes supported formats in Settings.
- Supports data bits 7 or 8.
- Supports parity none, even, and odd.
- Supports stop bits 1 or 2.
- Supports response timeout choices from 50 to 60000 ms.
- Persists the selected format, timeout, and last COM port in the Electron
  renderer profile.
- Preselects the remembered port without opening it automatically.
- Returns structured IPC results instead of throwing raw errors into renderer
  code.
- Sends one request frame and collects a response until the expected RTU length
  is reached or timeout expires.
- Provides the first serial-backed Master RTU actions used by the JWPLC Basic
  probe: FC1, FC2, FC5, and FC15.
- Provides generic bit and register actions for FC1, FC2, FC3, FC4, FC5,
  FC6, FC15, and FC16.
- Feeds the renderer Bus Monitor with TX/RX hex, elapsed time, and CRC status.
- Exports Bus Monitor captures through the shared Markdown report IPC.

## Deferred

- Retries around serial responses.
- Automatic reconnection after a device is unplugged.
- Signed, floating-point, and mixed-endian register display modes.
- Serial-backed slave sessions.
- Packaging validation for native serial bindings.

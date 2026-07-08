# Architecture

JW Modbus Tool is organized around clear boundaries so the protocol engine can
be tested without Electron, serial ports, or UI state.

## Layers

- `src/main`: Electron main process, IPC handlers, serial session ownership,
  config stores, preset stores, and desktop lifecycle.
- `src/preload`: Secure bridge between renderer and main. The renderer never
  receives raw Node.js access.
- `src/renderer`: React UI. This is currently a minimal placeholder until the
  protocol core compiles and tests pass.
- `src/shared/modbus`: Clean-room Modbus RTU engine, frame utilities, request
  encoders, response decoders, and simulator logic.
- `src/shared/serial`: Renderer-safe serial types shared across IPC boundaries.
- `src/shared/presets`: Bundled device presets, starting with JWPLC Basic Remote
  I/O.
- `src/shared/logging`: Log entry types used by future monitor and export code.
- `tests`: Unit tests focused on pure shared modules.

## Electron security baseline

The main window uses:

- `contextIsolation: true`
- `nodeIntegration: false`
- A preload bridge with explicit IPC methods only

Any future IPC channel should validate input in the main process before touching
serial ports, local files, or long-running sessions.

## Serial layer

The serial layer lives in `src/main/serial`. It owns `serialport` usage, validates
RTU serial settings, lists COM ports, and manages the current open port. The
renderer receives only structured results through preload IPC.

## Clean-room boundary

The Modbus engine is implemented from public protocol behavior and project
requirements. It must not copy code, UI, file structures, assets, or text from
existing Modbus tools.

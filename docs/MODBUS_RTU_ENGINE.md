# Modbus RTU Engine

The RTU engine lives in `src/shared/modbus` and is designed to be usable from the
Electron main process, tests, and future simulation tools.

## Implemented in this step

- CRC16/Modbus with low-byte/high-byte RTU ordering.
- RTU frame build and parse.
- Exception response build and decode.
- Hex formatting and byte utilities.
- Master request encoding:
  - FC1 Read Coils
  - FC2 Read Discrete Inputs
  - FC3 Read Holding Registers
  - FC4 Read Input Registers
  - FC5 Write Single Coil
  - FC6 Write Single Register
  - FC15 Write Multiple Coils
  - FC16 Write Multiple Registers
- Slave simulator response core:
  - Read coils and discrete inputs.
  - Read holding and input registers.
  - Write single coil and holding register.
  - Write multiple coils and holding registers.
  - Exception 0x01, 0x02, and 0x03.
  - CRC errors are ignored and reported as ignored results.
  - Unit ID mismatch is ignored.
  - Broadcast writes are applied without response.
  - Broadcast reads are ignored.
- Minimal serial-backed Master RTU probe:
  - FC1 Read Coils.
  - FC2 Read Discrete Inputs.
  - FC5 Write Single Coil.
  - FC15 Write Multiple Coils.
  - TX/RX hex summary and CRC status.
  - JWPLC Basic validation sequence with PASS/FAIL summary.

## Deferred

- Full serial timing and retry orchestration.
- Rich decoded data views.
- Float32, Int32, and endian display helpers.
- Bus monitor persistence and export.

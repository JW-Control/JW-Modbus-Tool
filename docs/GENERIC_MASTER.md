# Generic RTU Master

The Generic Master sends Modbus RTU requests through the active serial
connection and records every result in the Bus Monitor.

## Supported functions

- FC1 Read Coils: 1 to 2000 bits.
- FC2 Read Discrete Inputs: 1 to 2000 bits.
- FC3 Read Holding Registers: 1 to 125 registers.
- FC4 Read Input Registers: 1 to 125 registers.
- FC5 Write Single Coil.
- FC6 Write Single Register.
- FC15 Write Multiple Coils: 1 to 1968 values.
- FC16 Write Multiple Registers: 1 to 123 values.

Addresses use the zero-based Modbus protocol value. For example, a manual that
labels its first holding register as 40001 usually maps it to start address 0.

## Value formats

Single and multiple register values accept unsigned 16-bit decimal or
hexadecimal input:

```text
17, 0x1111, 65535
```

FC15 coil values accept commas, spaces, or semicolons and the following forms:

```text
ON, OFF, 1, 0, true, false
```

## Saved requests

Enter a preset name and choose `Save Preset` to persist the current function,
Unit ID, address, quantity, and values. Selecting a saved request restores the
complete form. `Update Preset` replaces the selected request and `Delete`
removes it.

Presets are stored locally in the Electron renderer profile. File-based JSON
import and export are deferred to a later milestone.

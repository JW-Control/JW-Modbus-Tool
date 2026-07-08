# Legal Clean-Room Policy

JW Modbus Tool is developed from scratch by JW Control.

## Rules

- Do not copy source code from QModMaster, PyModbus, libmodbus, Modbus Poll,
  ModScan, or any other existing Modbus tool.
- Do not copy internal structure, assets, icons, screen layouts, text, internal
  names, or branding from those tools.
- Do not use QModMaster as a base.
- Do not use libmodbus as a dependency.
- Do not use PyModbus as the main dependency for this Electron/TypeScript MVP.
- Do not add GPL, LGPL, or AGPL code to the repository.
- Treat existing tools only as external references for common Modbus workflows.
- Use the public Modbus protocol behavior and project requirements as the basis
  for implementation.

## Dependency policy

New dependencies must be permissive and compatible with MIT, or must be reviewed
before adoption. Each accepted dependency must be documented in
`THIRD_PARTY_NOTICES.md` with:

- Dependency name.
- License.
- Reason for use.
- Any notable packaging or security concerns.

## Assets

Do not include third-party logos, icons, screenshots, or visual assets unless
their license is reviewed and documented. The JW Control final icon and final
brand artwork are TODO items and should not be invented in this repository.

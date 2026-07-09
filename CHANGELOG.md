# Changelog

All notable changes to JW Modbus Tool will be documented in this file.

## 0.1.0 - Unreleased

### Added

- Initial Electron, TypeScript, React, and Vite project skeleton.
- Clean-room Modbus RTU shared engine foundation.
- CRC16/Modbus implementation.
- RTU frame parser and builder.
- Master request encoders for FC1, FC2, FC3, FC4, FC5, FC6, FC15, and FC16.
- Slave simulator response core for FC1, FC2, FC3, FC4, FC5, FC6, FC15, and FC16.
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

# Third-Party Notices

JW Modbus Tool uses permissive dependencies only. Dependencies must be reviewed
before they are added, and this file must be updated with the license and reason.

## Current dependencies

| Dependency | License | Reason |
| --- | --- | --- |
| Electron | MIT | Desktop runtime for Windows-first app shell. |
| React | MIT | Renderer UI framework. |
| React DOM | MIT | React DOM renderer. |
| Vite | MIT | Renderer dev server and bundler. |
| @vitejs/plugin-react | MIT | React integration for Vite. |
| TypeScript | Apache-2.0 | Static typing and compiler. |
| Vitest | MIT | Unit test runner for TypeScript modules. |
| electron-builder | MIT | Windows portable and installer packaging. |
| @types/node | MIT | Type definitions for Node.js APIs. |
| @types/react | MIT | Type definitions for React. |
| @types/react-dom | MIT | Type definitions for React DOM. |

## Planned review

A serial port library has not been added yet. Before adding one, confirm its
license, transitive dependency posture, Windows support, and compatibility with
Electron packaging.

# Third-Party Notices

JW Modbus Tool uses permissive dependencies only. Dependencies must be reviewed
before they are added, and this file must be updated with the license and reason.

## Current dependencies

| Dependency | License | Reason |
| --- | --- | --- |
| Electron | MIT | Desktop runtime for Windows-first app shell. |
| React | MIT | Renderer UI framework. |
| React DOM | MIT | React DOM renderer. |
| lucide-react | ISC | Interface icons for navigation, status, and actions. |
| serialport | MIT | COM port discovery and serial access from Electron main. |
| @serialport/* package family | MIT | Native bindings, mock binding, and parsers used by `serialport`. |
| Vite | MIT | Renderer dev server and bundler. |
| @vitejs/plugin-react | MIT | React integration for Vite. |
| TypeScript | Apache-2.0 | Static typing and compiler. |
| Vitest | MIT | Unit test runner for TypeScript modules. |
| electron-builder | MIT | Windows portable and installer packaging. |
| @types/node | MIT | Type definitions for Node.js APIs. |
| @types/react | MIT | Type definitions for React. |
| @types/react-dom | MIT | Type definitions for React DOM. |

## Serial dependency note

`serialport` is used only from the Electron main process. Renderer code reaches
it through explicit IPC methods exposed by preload, keeping Node.js APIs out of
the renderer.

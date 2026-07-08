import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("jwModbus", {
  appName: "JW Modbus Tool",
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node
  },
  serial: {
    listPorts: () => ipcRenderer.invoke("serial:listPorts"),
    getConnectionState: () => ipcRenderer.invoke("serial:getConnectionState"),
    open: (config: unknown) => ipcRenderer.invoke("serial:open", config),
    close: () => ipcRenderer.invoke("serial:close")
  }
});

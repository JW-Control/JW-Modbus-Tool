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
  },
  modbus: {
    readCoils: (command: unknown) => ipcRenderer.invoke("modbus:readCoils", command),
    readDiscreteInputs: (command: unknown) => ipcRenderer.invoke("modbus:readDiscreteInputs", command),
    readHoldingRegisters: (command: unknown) => ipcRenderer.invoke("modbus:readHoldingRegisters", command),
    readInputRegisters: (command: unknown) => ipcRenderer.invoke("modbus:readInputRegisters", command),
    writeSingleCoil: (command: unknown) => ipcRenderer.invoke("modbus:writeSingleCoil", command),
    writeMultipleCoils: (command: unknown) => ipcRenderer.invoke("modbus:writeMultipleCoils", command),
    writeSingleRegister: (command: unknown) => ipcRenderer.invoke("modbus:writeSingleRegister", command),
    writeMultipleRegisters: (command: unknown) => ipcRenderer.invoke("modbus:writeMultipleRegisters", command),
    runJwplcValidation: (command: unknown) => ipcRenderer.invoke("modbus:runJwplcValidation", command)
  },
  reports: {
    copyMarkdown: (markdown: unknown) => ipcRenderer.invoke("report:copyMarkdown", markdown),
    saveMarkdown: (request: unknown) => ipcRenderer.invoke("report:saveMarkdown", request)
  }
});

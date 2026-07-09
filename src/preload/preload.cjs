const { contextBridge, ipcRenderer } = require("electron");

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
    open: (config) => ipcRenderer.invoke("serial:open", config),
    close: () => ipcRenderer.invoke("serial:close")
  },
  modbus: {
    readCoils: (command) => ipcRenderer.invoke("modbus:readCoils", command),
    readDiscreteInputs: (command) => ipcRenderer.invoke("modbus:readDiscreteInputs", command),
    readHoldingRegisters: (command) => ipcRenderer.invoke("modbus:readHoldingRegisters", command),
    readInputRegisters: (command) => ipcRenderer.invoke("modbus:readInputRegisters", command),
    writeSingleCoil: (command) => ipcRenderer.invoke("modbus:writeSingleCoil", command),
    writeMultipleCoils: (command) => ipcRenderer.invoke("modbus:writeMultipleCoils", command),
    writeSingleRegister: (command) => ipcRenderer.invoke("modbus:writeSingleRegister", command),
    writeMultipleRegisters: (command) => ipcRenderer.invoke("modbus:writeMultipleRegisters", command),
    runJwplcValidation: (command) => ipcRenderer.invoke("modbus:runJwplcValidation", command)
  },
  reports: {
    copyMarkdown: (markdown) => ipcRenderer.invoke("report:copyMarkdown", markdown),
    saveMarkdown: (request) => ipcRenderer.invoke("report:saveMarkdown", request)
  }
});

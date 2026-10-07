const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("jwModbus", {
  appName: "JW Modbus Tool",
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node
  },
  window: {
    minimize: () => ipcRenderer.invoke("window:minimize"),
    maximize: () => ipcRenderer.invoke("window:maximize"),
    close: () => ipcRenderer.invoke("window:close")
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
  slave: {
    getState: () => ipcRenderer.invoke("slave:getState"),
    start: (config) => ipcRenderer.invoke("slave:start", config),
    stop: () => ipcRenderer.invoke("slave:stop"),
    addDevice: (request) => ipcRenderer.invoke("slave:addDevice", request),
    removeDevice: (unitId) => ipcRenderer.invoke("slave:removeDevice", unitId),
    getDevice: (unitId) => ipcRenderer.invoke("slave:getDevice", unitId),
    setValue: (request) => ipcRenderer.invoke("slave:setValue", request),
    setFaults: (request) => ipcRenderer.invoke("slave:setFaults", request),
    exportDevices: () => ipcRenderer.invoke("slave:exportDevices"),
    getTraffic: () => ipcRenderer.invoke("slave:getTraffic"),
    clearTraffic: () => ipcRenderer.invoke("slave:clearTraffic"),
    importDevices: (devices) => ipcRenderer.invoke("slave:importDevices", devices),
    onEvent: (listener) => {
      const handler = (_event, payload) => listener(payload);
      ipcRenderer.on("slave:event", handler);
      return () => {
        ipcRenderer.removeListener("slave:event", handler);
      };
    }
  },
  sessions: {
    saveFile: (request) => ipcRenderer.invoke("session:saveFile", request),
    openFile: (request) => ipcRenderer.invoke("session:openFile", request)
  },
  reports: {
    copyMarkdown: (markdown) => ipcRenderer.invoke("report:copyMarkdown", markdown),
    saveMarkdown: (request) => ipcRenderer.invoke("report:saveMarkdown", request)
  }
});

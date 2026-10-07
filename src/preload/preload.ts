import { contextBridge, ipcRenderer } from "electron";

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
  slave: {
    getState: () => ipcRenderer.invoke("slave:getState"),
    start: (config: unknown) => ipcRenderer.invoke("slave:start", config),
    stop: () => ipcRenderer.invoke("slave:stop"),
    addDevice: (request: unknown) => ipcRenderer.invoke("slave:addDevice", request),
    removeDevice: (unitId: unknown) => ipcRenderer.invoke("slave:removeDevice", unitId),
    getDevice: (unitId: unknown) => ipcRenderer.invoke("slave:getDevice", unitId),
    setValue: (request: unknown) => ipcRenderer.invoke("slave:setValue", request),
    setFaults: (request: unknown) => ipcRenderer.invoke("slave:setFaults", request),
    exportDevices: () => ipcRenderer.invoke("slave:exportDevices"),
    getTraffic: () => ipcRenderer.invoke("slave:getTraffic"),
    clearTraffic: () => ipcRenderer.invoke("slave:clearTraffic"),
    importDevices: (devices: unknown) => ipcRenderer.invoke("slave:importDevices", devices),
    onEvent: (listener: (event: unknown) => void) => {
      const handler = (_event: unknown, payload: unknown) => listener(payload);
      ipcRenderer.on("slave:event", handler);
      return () => {
        ipcRenderer.removeListener("slave:event", handler);
      };
    }
  },
  sessions: {
    saveFile: (request: unknown) => ipcRenderer.invoke("session:saveFile", request),
    openFile: (request?: unknown) => ipcRenderer.invoke("session:openFile", request)
  },
  reports: {
    copyMarkdown: (markdown: unknown) => ipcRenderer.invoke("report:copyMarkdown", markdown),
    saveMarkdown: (request: unknown) => ipcRenderer.invoke("report:saveMarkdown", request)
  }
});

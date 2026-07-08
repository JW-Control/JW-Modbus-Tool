export const jwplcRemoteIoPreset = {
  id: "jwplc-remote-io-poc-1",
  name: "JWPLC Remote I/O Slave RTU - PoC 1",
  mode: "master-rtu",
  serial: {
    baudRate: 115200,
    dataBits: 8,
    parity: "none",
    stopBits: 1,
    timeoutMs: 1000,
    retries: 1
  },
  modbus: {
    unitId: 2
  },
  map: {
    discreteInputs: {
      functionCode: 2,
      startAddress: 0,
      quantity: 8,
      labels: ["I0_0", "I0_1", "I0_2", "I0_3", "I0_4", "I0_5", "I0_6", "I0_7"]
    },
    outputFeedback: {
      functionCode: 1,
      startAddress: 0,
      quantity: 8,
      labels: ["Q0_0", "Q0_1", "Q0_2", "Q0_3", "Q0_4", "Q0_5", "Q0_6", "Q0_7"]
    }
  }
} as const;

export enum FunctionCode {
  ReadCoils = 0x01,
  ReadDiscreteInputs = 0x02,
  ReadHoldingRegisters = 0x03,
  ReadInputRegisters = 0x04,
  WriteSingleCoil = 0x05,
  WriteSingleRegister = 0x06,
  WriteMultipleCoils = 0x0f,
  WriteMultipleRegisters = 0x10,
  ReportServerId = 0x11,
  MaskWriteRegister = 0x16,
  ReadWriteMultipleRegisters = 0x17,
  EncapsulatedInterface = 0x2b
}

/** MEI type of FC43 used for Read Device Identification. */
export const MEI_READ_DEVICE_ID = 0x0e;

export const supportedFunctionCodes = new Set<number>([
  FunctionCode.ReadCoils,
  FunctionCode.ReadDiscreteInputs,
  FunctionCode.ReadHoldingRegisters,
  FunctionCode.ReadInputRegisters,
  FunctionCode.WriteSingleCoil,
  FunctionCode.WriteSingleRegister,
  FunctionCode.WriteMultipleCoils,
  FunctionCode.WriteMultipleRegisters,
  FunctionCode.ReportServerId,
  FunctionCode.MaskWriteRegister,
  FunctionCode.ReadWriteMultipleRegisters,
  FunctionCode.EncapsulatedInterface
]);

export function functionCodeName(functionCode: number): string {
  switch (functionCode) {
    case FunctionCode.ReadCoils:
      return "Read Coils";
    case FunctionCode.ReadDiscreteInputs:
      return "Read Discrete Inputs";
    case FunctionCode.ReadHoldingRegisters:
      return "Read Holding Registers";
    case FunctionCode.ReadInputRegisters:
      return "Read Input Registers";
    case FunctionCode.WriteSingleCoil:
      return "Write Single Coil";
    case FunctionCode.WriteSingleRegister:
      return "Write Single Register";
    case FunctionCode.WriteMultipleCoils:
      return "Write Multiple Coils";
    case FunctionCode.WriteMultipleRegisters:
      return "Write Multiple Registers";
    case FunctionCode.ReportServerId:
      return "Report Server ID";
    case FunctionCode.MaskWriteRegister:
      return "Mask Write Register";
    case FunctionCode.ReadWriteMultipleRegisters:
      return "Read/Write Multiple Registers";
    case FunctionCode.EncapsulatedInterface:
      return "Read Device Identification";
    default:
      return `Unknown Function 0x${functionCode.toString(16).padStart(2, "0")}`;
  }
}

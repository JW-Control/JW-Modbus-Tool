import { isExceptionFunctionCode } from "./exceptions.js";
import { FunctionCode } from "./functionCodes.js";

export function expectedRtuResponseLength(bytes: Uint8Array): number | null {
  if (bytes.length < 2) {
    return null;
  }

  const functionCode = bytes[1];

  if (isExceptionFunctionCode(functionCode)) {
    return 5;
  }

  switch (functionCode) {
    case FunctionCode.ReadCoils:
    case FunctionCode.ReadDiscreteInputs:
    case FunctionCode.ReadHoldingRegisters:
    case FunctionCode.ReadInputRegisters:
      return bytes.length >= 3 ? 3 + bytes[2] + 2 : null;
    case FunctionCode.WriteSingleCoil:
    case FunctionCode.WriteSingleRegister:
    case FunctionCode.WriteMultipleCoils:
    case FunctionCode.WriteMultipleRegisters:
      return 8;
    default:
      return null;
  }
}

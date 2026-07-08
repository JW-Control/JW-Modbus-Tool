export enum ExceptionCode {
  IllegalFunction = 0x01,
  IllegalDataAddress = 0x02,
  IllegalDataValue = 0x03
}

export interface DecodedExceptionResponse {
  unitId: number;
  functionCode: number;
  exceptionFunctionCode: number;
  exceptionCode: ExceptionCode;
  exceptionName: string;
}

export function toExceptionFunctionCode(functionCode: number): number {
  return functionCode | 0x80;
}

export function isExceptionFunctionCode(functionCode: number): boolean {
  return (functionCode & 0x80) === 0x80;
}

export function originalFunctionCode(exceptionFunctionCode: number): number {
  return exceptionFunctionCode & 0x7f;
}

export function exceptionCodeName(exceptionCode: number): string {
  switch (exceptionCode) {
    case ExceptionCode.IllegalFunction:
      return "Illegal Function";
    case ExceptionCode.IllegalDataAddress:
      return "Illegal Data Address";
    case ExceptionCode.IllegalDataValue:
      return "Illegal Data Value";
    default:
      return `Unknown Exception 0x${exceptionCode.toString(16).padStart(2, "0")}`;
  }
}

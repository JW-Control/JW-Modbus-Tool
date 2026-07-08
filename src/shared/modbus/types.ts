export interface ParsedRtuFrame {
  raw: Uint8Array;
  unitId: number;
  pdu: Uint8Array;
  functionCode: number;
  data: Uint8Array;
  crc: number;
  computedCrc: number;
  crcOk: boolean;
}

export interface ReadAddressRange {
  unitId: number;
  startAddress: number;
  quantity: number;
}

export interface WriteSingleValue {
  unitId: number;
  address: number;
  value: number | boolean;
}

export interface WriteMultipleValues<TValue> {
  unitId: number;
  startAddress: number;
  values: TValue[];
}

export interface DecodedBitReadResponse {
  unitId: number;
  functionCode: number;
  values: boolean[];
}

export interface DecodedRegisterReadResponse {
  unitId: number;
  functionCode: number;
  values: number[];
}

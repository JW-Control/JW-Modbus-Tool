import { encodeReadDiscreteInputsRequest } from "../../shared/modbus/masterRequests.js";

export interface RtuMasterSessionOptions {
  unitId: number;
  timeoutMs: number;
  retries: number;
}

export class RtuMasterSession {
  constructor(private readonly options: RtuMasterSessionOptions) {}

  buildReadDiscreteInputs(startAddress: number, quantity: number): Uint8Array {
    return encodeReadDiscreteInputsRequest({
      unitId: this.options.unitId,
      startAddress,
      quantity
    });
  }
}

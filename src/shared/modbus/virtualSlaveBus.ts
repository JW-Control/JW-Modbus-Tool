import { hasValidCrc } from "./crc16.js";
import { isExceptionFunctionCode } from "./exceptions.js";
import { FunctionCode } from "./functionCodes.js";
import {
  createSlaveDataModel,
  handleRtuSlaveRequest,
  type SlaveDataModel,
  type SlaveFrameResult
} from "./slaveResponses.js";
import type {
  SetVirtualValueRequest,
  SlaveTable,
  VirtualDeviceSizes,
  VirtualDeviceSnapshot,
  VirtualDeviceSummary
} from "../slave/types.js";

export const DEFAULT_VIRTUAL_TABLE_SIZE = 64;
export const MAX_VIRTUAL_TABLE_SIZE = 9999;

const slaveTables: readonly SlaveTable[] = ["coils", "discreteInputs", "holdingRegisters", "inputRegisters"];

const writeFunctionCodes = new Set<number>([
  FunctionCode.WriteSingleCoil,
  FunctionCode.WriteSingleRegister,
  FunctionCode.WriteMultipleCoils,
  FunctionCode.WriteMultipleRegisters
]);

interface VirtualSlaveDevice {
  unitId: number;
  name: string;
  model: SlaveDataModel;
  requests: number;
}

export type VirtualBusFrameResult = SlaveFrameResult & {
  unitId: number | null;
  functionCode: number | null;
  changedUnitIds: number[];
};

/** Several virtual slaves sharing one RTU line, each answering its own unit id. */
export class VirtualSlaveBus {
  private readonly devices = new Map<number, VirtualSlaveDevice>();

  addDevice(unitId: number, name?: string, sizes: Partial<VirtualDeviceSizes> = {}): VirtualDeviceSummary {
    if (!Number.isInteger(unitId) || unitId < 1 || unitId > 247) {
      throw new RangeError("El Unit ID debe ser un entero entre 1 y 247");
    }

    if (this.devices.has(unitId)) {
      throw new Error(`Ya existe un dispositivo virtual con ID ${unitId}`);
    }

    const resolvedSizes: VirtualDeviceSizes = {
      coils: resolveTableSize(sizes.coils),
      discreteInputs: resolveTableSize(sizes.discreteInputs),
      holdingRegisters: resolveTableSize(sizes.holdingRegisters),
      inputRegisters: resolveTableSize(sizes.inputRegisters)
    };
    const device: VirtualSlaveDevice = {
      unitId,
      name: name?.trim() || `Slave virtual ${unitId}`,
      model: createSlaveDataModel({
        coilCount: resolvedSizes.coils,
        discreteInputCount: resolvedSizes.discreteInputs,
        holdingRegisterCount: resolvedSizes.holdingRegisters,
        inputRegisterCount: resolvedSizes.inputRegisters
      }),
      requests: 0
    };

    this.devices.set(unitId, device);
    return summarize(device);
  }

  removeDevice(unitId: number): boolean {
    return this.devices.delete(unitId);
  }

  listDevices(): VirtualDeviceSummary[] {
    return [...this.devices.values()].sort((left, right) => left.unitId - right.unitId).map(summarize);
  }

  getDevice(unitId: number): VirtualDeviceSnapshot {
    const device = this.requireDevice(unitId);

    return {
      ...summarize(device),
      coils: [...device.model.coils],
      discreteInputs: [...device.model.discreteInputs],
      holdingRegisters: [...device.model.holdingRegisters],
      inputRegisters: [...device.model.inputRegisters]
    };
  }

  setValue(request: SetVirtualValueRequest): VirtualDeviceSnapshot {
    const device = this.requireDevice(request.unitId);

    if (!slaveTables.includes(request.table)) {
      throw new Error(`Tabla desconocida: ${String(request.table)}`);
    }

    const table = device.model[request.table];

    if (!Number.isInteger(request.address) || request.address < 0 || request.address >= table.length) {
      throw new RangeError(`La dirección ${request.address} está fuera de la tabla (0 a ${table.length - 1})`);
    }

    if (request.table === "coils" || request.table === "discreteInputs") {
      device.model[request.table][request.address] = Boolean(request.value);
    } else {
      const value = Number(request.value);

      if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
        throw new RangeError("El valor de un registro debe ser un entero entre 0 y 65535");
      }

      device.model[request.table][request.address] = value;
    }

    return this.getDevice(request.unitId);
  }

  handleFrame(frame: Uint8Array): VirtualBusFrameResult {
    if (frame.length < 4) {
      return {
        kind: "ignored",
        reason: "frame-error",
        summary: "Trama incompleta",
        unitId: frame.length > 0 ? frame[0] : null,
        functionCode: frame.length > 1 ? frame[1] : null,
        changedUnitIds: []
      };
    }

    const unitId = frame[0];
    const functionCode = frame[1];

    if (!hasValidCrc(frame)) {
      return { kind: "ignored", reason: "crc-error", summary: "Error de CRC", unitId, functionCode, changedUnitIds: [] };
    }

    if (unitId === 0) {
      return this.handleBroadcast(frame, functionCode);
    }

    const device = this.devices.get(unitId);

    if (!device) {
      return {
        kind: "ignored",
        reason: "unit-id-mismatch",
        summary: `Sin dispositivo virtual con ID ${unitId}`,
        unitId,
        functionCode,
        changedUnitIds: []
      };
    }

    device.requests += 1;
    const result = handleRtuSlaveRequest(frame, device.model, { unitId });
    const wroteValues =
      writeFunctionCodes.has(functionCode) &&
      result.kind === "response" &&
      !isExceptionFunctionCode(result.response[1]);

    return { ...result, unitId, functionCode, changedUnitIds: wroteValues ? [unitId] : [] };
  }

  private handleBroadcast(frame: Uint8Array, functionCode: number): VirtualBusFrameResult {
    const devices = [...this.devices.values()];

    if (devices.length === 0) {
      return {
        kind: "ignored",
        reason: "unit-id-mismatch",
        summary: "Broadcast sin dispositivos virtuales",
        unitId: 0,
        functionCode,
        changedUnitIds: []
      };
    }

    const results = devices.map((device) => {
      device.requests += 1;
      return handleRtuSlaveRequest(frame, device.model, { unitId: device.unitId });
    });
    const changedUnitIds = writeFunctionCodes.has(functionCode) ? devices.map((device) => device.unitId) : [];

    return { ...results[0], unitId: 0, functionCode, changedUnitIds };
  }

  private requireDevice(unitId: number): VirtualSlaveDevice {
    const device = this.devices.get(unitId);

    if (!device) {
      throw new Error(`No existe un dispositivo virtual con ID ${unitId}`);
    }

    return device;
  }
}

function resolveTableSize(size: number | undefined): number {
  const resolved = size ?? DEFAULT_VIRTUAL_TABLE_SIZE;

  if (!Number.isInteger(resolved) || resolved < 1 || resolved > MAX_VIRTUAL_TABLE_SIZE) {
    throw new RangeError(`El tamaño de cada tabla debe estar entre 1 y ${MAX_VIRTUAL_TABLE_SIZE}`);
  }

  return resolved;
}

function summarize(device: VirtualSlaveDevice): VirtualDeviceSummary {
  return {
    unitId: device.unitId,
    name: device.name,
    sizes: {
      coils: device.model.coils.length,
      discreteInputs: device.model.discreteInputs.length,
      holdingRegisters: device.model.holdingRegisters.length,
      inputRegisters: device.model.inputRegisters.length
    },
    requests: device.requests
  };
}

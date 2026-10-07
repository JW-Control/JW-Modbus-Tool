import { hasValidCrc } from "./crc16.js";
import { isExceptionFunctionCode } from "./exceptions.js";
import { FunctionCode } from "./functionCodes.js";
import { buildExceptionFrame } from "./rtuFrame.js";
import {
  createSlaveDataModel,
  handleRtuSlaveRequest,
  type SlaveDataModel,
  type SlaveFrameResult
} from "./slaveResponses.js";
import { findVirtualDeviceTemplate } from "../slave/templates.js";
import type {
  SetVirtualValueRequest,
  SlaveTable,
  VirtualDeviceConfig,
  VirtualDeviceFaults,
  VirtualDeviceLabels,
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

export const noFaults: VirtualDeviceFaults = { mode: "none", delayMs: 0, exceptionCode: 2 };

const MAX_FAULT_DELAY_MS = 60000;

interface VirtualSlaveDevice {
  unitId: number;
  name: string;
  template: string | null;
  labels: VirtualDeviceLabels;
  faults: VirtualDeviceFaults;
  model: SlaveDataModel;
  requests: number;
}

export type VirtualBusFrameResult = (SlaveFrameResult | { kind: "silenced"; summary: string }) & {
  unitId: number | null;
  functionCode: number | null;
  changedUnitIds: number[];
  /** Fault applied by the addressed device, if any. */
  fault: VirtualDeviceFaults | null;
};

/** Several virtual slaves sharing one RTU line, each answering its own unit id. */
export class VirtualSlaveBus {
  private readonly devices = new Map<number, VirtualSlaveDevice>();

  addDevice(
    unitId: number,
    name?: string,
    sizes: Partial<VirtualDeviceSizes> = {},
    templateId?: string
  ): VirtualDeviceSummary {
    assertUnitId(unitId);

    if (this.devices.has(unitId)) {
      throw new Error(`Ya existe un dispositivo virtual con ID ${unitId}`);
    }

    const template = templateId ? findVirtualDeviceTemplate(templateId) : undefined;

    if (templateId && !template) {
      throw new Error(`Plantilla desconocida: ${templateId}`);
    }

    const resolvedSizes = template?.sizes ?? {
      coils: resolveTableSize(sizes.coils),
      discreteInputs: resolveTableSize(sizes.discreteInputs),
      holdingRegisters: resolveTableSize(sizes.holdingRegisters),
      inputRegisters: resolveTableSize(sizes.inputRegisters)
    };
    const device: VirtualSlaveDevice = {
      unitId,
      name: name?.trim() || template?.name || `Slave virtual ${unitId}`,
      template: template?.id ?? null,
      labels: cloneLabels(template?.labels ?? {}),
      faults: { ...noFaults },
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
    return this.sortedDevices().map(summarize);
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
      device.model[request.table][request.address] = toRegisterValue(request.value);
    }

    return this.getDevice(request.unitId);
  }

  setFaults(unitId: number, faults: Partial<VirtualDeviceFaults>): VirtualDeviceSummary {
    const device = this.requireDevice(unitId);
    device.faults = resolveFaults({ ...device.faults, ...faults });
    return summarize(device);
  }

  exportDevices(): VirtualDeviceConfig[] {
    return this.sortedDevices().map((device) => ({
      unitId: device.unitId,
      name: device.name,
      template: device.template,
      labels: cloneLabels(device.labels),
      faults: { ...device.faults },
      values: {
        coils: [...device.model.coils],
        discreteInputs: [...device.model.discreteInputs],
        holdingRegisters: [...device.model.holdingRegisters],
        inputRegisters: [...device.model.inputRegisters]
      }
    }));
  }

  /** Replaces every device. Validates the whole list first, so a bad file changes nothing. */
  replaceDevices(configs: readonly VirtualDeviceConfig[]): void {
    if (!Array.isArray(configs)) {
      throw new Error("La configuración del simulador no contiene una lista de dispositivos");
    }

    const next = new Map<number, VirtualSlaveDevice>();

    for (const config of configs) {
      assertUnitId(config?.unitId);

      if (next.has(config.unitId)) {
        throw new Error(`El ID ${config.unitId} aparece dos veces en la configuración`);
      }

      const values = config.values ?? { coils: [], discreteInputs: [], holdingRegisters: [], inputRegisters: [] };
      const model: SlaveDataModel = {
        coils: toBitTable(values.coils),
        discreteInputs: toBitTable(values.discreteInputs),
        holdingRegisters: toRegisterTable(values.holdingRegisters),
        inputRegisters: toRegisterTable(values.inputRegisters)
      };

      next.set(config.unitId, {
        unitId: config.unitId,
        name: String(config.name ?? "").trim() || `Slave virtual ${config.unitId}`,
        template: findVirtualDeviceTemplate(config.template) ? config.template : null,
        labels: cloneLabels(config.labels ?? {}),
        faults: resolveFaults({ ...noFaults, ...config.faults }),
        model,
        requests: 0
      });
    }

    this.devices.clear();
    next.forEach((device, unitId) => this.devices.set(unitId, device));
  }

  handleFrame(frame: Uint8Array): VirtualBusFrameResult {
    if (frame.length < 4) {
      return {
        kind: "ignored",
        reason: "frame-error",
        summary: "Trama incompleta",
        unitId: frame.length > 0 ? frame[0] : null,
        functionCode: frame.length > 1 ? frame[1] : null,
        changedUnitIds: [],
        fault: null
      };
    }

    const unitId = frame[0];
    const functionCode = frame[1];

    if (!hasValidCrc(frame)) {
      return { kind: "ignored", reason: "crc-error", summary: "Error de CRC", unitId, functionCode, changedUnitIds: [], fault: null };
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
        changedUnitIds: [],
        fault: null
      };
    }

    device.requests += 1;
    const faults = device.faults;
    const fault = faults.mode === "none" && faults.delayMs === 0 ? null : { ...faults };

    if (faults.mode === "no-response") {
      return { kind: "silenced", summary: "Falla: sin respuesta", unitId, functionCode, changedUnitIds: [], fault };
    }

    if (faults.mode === "exception") {
      return {
        kind: "response",
        response: buildExceptionFrame(unitId, functionCode, faults.exceptionCode),
        summary: `Falla: excepción ${String(faults.exceptionCode).padStart(2, "0")} forzada`,
        unitId,
        functionCode,
        changedUnitIds: [],
        fault
      };
    }

    const result = handleRtuSlaveRequest(frame, device.model, { unitId });
    const wroteValues =
      writeFunctionCodes.has(functionCode) &&
      result.kind === "response" &&
      !isExceptionFunctionCode(result.response[1]);
    const changedUnitIds = wroteValues ? [unitId] : [];

    if (faults.mode === "bad-crc" && result.kind === "response") {
      const corrupted = result.response.slice();
      corrupted[corrupted.length - 1] ^= 0xff;
      return { ...result, response: corrupted, summary: `${result.summary} (CRC corrupto)`, unitId, functionCode, changedUnitIds, fault };
    }

    return { ...result, unitId, functionCode, changedUnitIds, fault };
  }

  private handleBroadcast(frame: Uint8Array, functionCode: number): VirtualBusFrameResult {
    const devices = this.sortedDevices();

    if (devices.length === 0) {
      return {
        kind: "ignored",
        reason: "unit-id-mismatch",
        summary: "Broadcast sin dispositivos virtuales",
        unitId: 0,
        functionCode,
        changedUnitIds: [],
        fault: null
      };
    }

    // A silenced device ignores broadcasts too; the other faults only shape responses, which broadcasts never get.
    const listening = devices.filter((device) => device.faults.mode !== "no-response");
    const results = listening.map((device) => {
      device.requests += 1;
      return handleRtuSlaveRequest(frame, device.model, { unitId: device.unitId });
    });
    const changedUnitIds = writeFunctionCodes.has(functionCode) ? listening.map((device) => device.unitId) : [];
    const first = results[0] ?? { kind: "silenced" as const, summary: "Broadcast ignorado: todos los dispositivos están sin respuesta" };

    return { ...first, unitId: 0, functionCode, changedUnitIds, fault: null };
  }

  private sortedDevices(): VirtualSlaveDevice[] {
    return [...this.devices.values()].sort((left, right) => left.unitId - right.unitId);
  }

  private requireDevice(unitId: number): VirtualSlaveDevice {
    const device = this.devices.get(unitId);

    if (!device) {
      throw new Error(`No existe un dispositivo virtual con ID ${unitId}`);
    }

    return device;
  }
}

function assertUnitId(unitId: unknown): asserts unitId is number {
  if (typeof unitId !== "number" || !Number.isInteger(unitId) || unitId < 1 || unitId > 247) {
    throw new RangeError("El Unit ID debe ser un entero entre 1 y 247");
  }
}

function resolveTableSize(size: number | undefined): number {
  const resolved = size ?? DEFAULT_VIRTUAL_TABLE_SIZE;

  if (!Number.isInteger(resolved) || resolved < 0 || resolved > MAX_VIRTUAL_TABLE_SIZE) {
    throw new RangeError(`El tamaño de cada tabla debe estar entre 0 y ${MAX_VIRTUAL_TABLE_SIZE}`);
  }

  return resolved;
}

function resolveFaults(faults: VirtualDeviceFaults): VirtualDeviceFaults {
  if (!["none", "no-response", "bad-crc", "exception"].includes(faults.mode)) {
    throw new Error(`Modo de falla desconocido: ${String(faults.mode)}`);
  }

  if (!Number.isInteger(faults.delayMs) || faults.delayMs < 0 || faults.delayMs > MAX_FAULT_DELAY_MS) {
    throw new RangeError(`El retardo debe ser un entero entre 0 y ${MAX_FAULT_DELAY_MS} ms`);
  }

  if (![1, 2, 3, 4].includes(faults.exceptionCode)) {
    throw new RangeError("El código de excepción forzada debe ser 01, 02, 03 o 04");
  }

  return { mode: faults.mode, delayMs: faults.delayMs, exceptionCode: faults.exceptionCode };
}

function toRegisterValue(value: unknown): number {
  const numeric = Number(value);

  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 0xffff) {
    throw new RangeError("El valor de un registro debe ser un entero entre 0 y 65535");
  }

  return numeric;
}

function toBitTable(values: unknown): boolean[] {
  const list = Array.isArray(values) ? values : [];

  if (list.length > MAX_VIRTUAL_TABLE_SIZE) {
    throw new RangeError(`Una tabla supera las ${MAX_VIRTUAL_TABLE_SIZE} posiciones`);
  }

  return list.map(Boolean);
}

function toRegisterTable(values: unknown): number[] {
  const list = Array.isArray(values) ? values : [];

  if (list.length > MAX_VIRTUAL_TABLE_SIZE) {
    throw new RangeError(`Una tabla supera las ${MAX_VIRTUAL_TABLE_SIZE} posiciones`);
  }

  return list.map(toRegisterValue);
}

function cloneLabels(labels: VirtualDeviceLabels): VirtualDeviceLabels {
  return Object.fromEntries(
    Object.entries(labels)
      .filter(([table, names]) => slaveTables.includes(table as SlaveTable) && Array.isArray(names))
      .map(([table, names]) => [table, names.map(String)])
  );
}

function summarize(device: VirtualSlaveDevice): VirtualDeviceSummary {
  return {
    unitId: device.unitId,
    name: device.name,
    template: device.template,
    sizes: {
      coils: device.model.coils.length,
      discreteInputs: device.model.discreteInputs.length,
      holdingRegisters: device.model.holdingRegisters.length,
      inputRegisters: device.model.inputRegisters.length
    },
    labels: cloneLabels(device.labels),
    faults: { ...device.faults },
    requests: device.requests
  };
}

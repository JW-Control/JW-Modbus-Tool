import { buildAsciiAdu, buildMbapAdu, parseAsciiAdu, parseMbapAdu, type Framing } from "./adu.js";
import { hasValidCrc } from "./crc16.js";
import { isExceptionFunctionCode } from "./exceptions.js";
import { FunctionCode } from "./functionCodes.js";
import { buildRtuFrame } from "./rtuFrame.js";
import {
  createSlaveDataModel,
  defaultSlaveIdentity,
  exceptionPdu,
  handleSlavePdu,
  type SlaveDataModel,
  type SlaveFrameResult,
  type SlaveIdentity,
  type SlavePduResult
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
  FunctionCode.MaskWriteRegister,
  FunctionCode.ReadWriteMultipleRegisters,
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

export type VirtualBusFrameResult = (
  | (Extract<SlaveFrameResult, { kind: "response" }> & { responsePdu?: Uint8Array })
  | Exclude<SlaveFrameResult, { kind: "response" }>
  | { kind: "silenced"; summary: string }
) & {
  unitId: number | null;
  functionCode: number | null;
  changedUnitIds: number[];
  /** Fault applied by the addressed device, if any. */
  fault: VirtualDeviceFaults | null;
};

type BusMeta = {
  unitId: number | null;
  functionCode: number | null;
  changedUnitIds: number[];
  /** Fault applied by the addressed device, if any. */
  fault: VirtualDeviceFaults | null;
};

/** Result of `handleRequest`: a response PDU the transport wraps in its own ADU. */
export type VirtualBusPduResult = (
  | SlavePduResult
  | { kind: "silenced"; summary: string }
  | { kind: "ignored"; reason: "frame-error" | "unit-id-mismatch"; summary: string }
) &
  BusMeta & { corrupt?: boolean };

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

  /**
   * Handles one whole request frame in the given framing and returns the
   * response frame in the same framing.
   */
  handleAdu(framing: Framing, frame: Uint8Array): VirtualBusFrameResult {
    if (framing === "rtu") return this.handleFrame(frame);

    const parsed = framing === "ascii" ? parseAsciiAdu(frame) : parseMbapAdu(frame);
    const unitId = parsed.pdu.length > 0 || parsed.checkOk ? parsed.unitId : null;
    const functionCode = parsed.pdu.length > 0 ? parsed.pdu[0] : null;

    if (!parsed.checkOk) {
      const reason = parsed.checkError === "Error de LRC" ? "crc-error" : "frame-error";
      return { kind: "ignored", reason, summary: parsed.checkError ?? "Trama inválida", unitId, functionCode, changedUnitIds: [], fault: null };
    }

    const result = this.handleRequest(parsed.unitId, parsed.pdu);

    if (result.kind !== "response") {
      const { corrupt: _corrupt, ...rest } = result;
      return rest as VirtualBusFrameResult;
    }

    let response: Uint8Array;

    if (framing === "ascii") {
      response = buildAsciiAdu(parsed.unitId, result.pdu);
      if (result.corrupt) {
        // Damage the LRC characters (just before CR LF).
        response[response.length - 3] = response[response.length - 3] === 0x30 ? 0x31 : 0x30;
      }
    } else {
      response = buildMbapAdu(parsed.transactionId ?? 0, parsed.unitId, result.pdu);
      if (result.corrupt) {
        // No CRC on TCP: a wrong protocol id makes the reply just as invalid.
        response[2] = 0xff;
        response[3] = 0xff;
      }
    }

    return {
      kind: "response",
      response,
      responsePdu: result.pdu,
      summary: result.summary,
      unitId: result.unitId,
      functionCode: result.functionCode,
      changedUnitIds: result.changedUnitIds,
      fault: result.fault
    };
  }

  /** Handles a whole RTU frame (unit id + PDU + CRC). */
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

    const result = this.handleRequest(unitId, frame.slice(1, -2));

    if (result.kind !== "response") {
      const { corrupt: _corrupt, ...rest } = result;
      return rest as VirtualBusFrameResult;
    }

    const response = buildRtuFrame(unitId, result.pdu);

    if (result.corrupt) {
      response[response.length - 1] ^= 0xff;
    }

    return {
      kind: "response",
      response,
      responsePdu: result.pdu,
      summary: result.summary,
      unitId: result.unitId,
      functionCode: result.functionCode,
      changedUnitIds: result.changedUnitIds,
      fault: result.fault
    };
  }

  /**
   * Handles one request PDU for `unitId`, whatever the transport (RTU, ASCII
   * or TCP). With the "bad-crc" fault the result is marked `corrupt` and the
   * transport damages its own check (CRC, LRC or MBAP header).
   */
  handleRequest(unitId: number, pdu: Uint8Array): VirtualBusPduResult {
    const functionCode = pdu.length > 0 ? pdu[0] : null;

    if (pdu.length === 0) {
      return { kind: "ignored", reason: "frame-error", summary: "PDU vacía", unitId, functionCode, changedUnitIds: [], fault: null };
    }

    if (unitId === 0) {
      return this.handleBroadcast(pdu);
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
        pdu: exceptionPdu(pdu[0], faults.exceptionCode),
        summary: `Falla: excepción ${String(faults.exceptionCode).padStart(2, "0")} forzada`,
        unitId,
        functionCode,
        changedUnitIds: [],
        fault
      };
    }

    const result = handleSlavePdu(pdu, device.model, { unitId, isBroadcast: false, identity: identityOf(device) });
    const wroteValues = writeFunctionCodes.has(pdu[0]) && result.kind === "response" && !isExceptionFunctionCode(result.pdu[0]);
    const changedUnitIds = wroteValues ? [unitId] : [];

    if (faults.mode === "bad-crc" && result.kind === "response") {
      return { ...result, summary: `${result.summary} (CRC corrupto)`, unitId, functionCode, changedUnitIds, fault, corrupt: true };
    }

    return { ...result, unitId, functionCode, changedUnitIds, fault };
  }

  private handleBroadcast(pdu: Uint8Array): VirtualBusPduResult {
    const functionCode = pdu[0];
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
      return handleSlavePdu(pdu, device.model, { unitId: device.unitId, isBroadcast: true, identity: identityOf(device) });
    });
    const changedUnitIds = writeFunctionCodes.has(functionCode) ? listening.map((device) => device.unitId) : [];
    const first = results[0] ?? { kind: "silenced" as const, summary: "Broadcast ignorado: todos los dispositivos están sin respuesta" };

    return { ...first, unitId: 0, functionCode, changedUnitIds, fault: null } as VirtualBusPduResult;
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

function identityOf(device: VirtualSlaveDevice): SlaveIdentity {
  const template = device.template ? findVirtualDeviceTemplate(device.template) : undefined;
  return {
    ...defaultSlaveIdentity,
    productCode: device.template ?? defaultSlaveIdentity.productCode,
    productName: device.name,
    modelName: template?.name ?? "Genérico"
  };
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

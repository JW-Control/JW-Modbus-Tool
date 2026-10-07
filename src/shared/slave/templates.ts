import { jwplcRemoteIoPreset } from "../presets/jwplcRemoteIoPreset.js";
import type { SlaveSimulatorSettings, VirtualDeviceLabels, VirtualDeviceSizes } from "./types.js";

export interface VirtualDeviceTemplate {
  id: string;
  name: string;
  description: string;
  unitId: number;
  /** Serial format the real device uses; the port is chosen by the user. */
  serial: Omit<SlaveSimulatorSettings, "port"> | null;
  sizes: VirtualDeviceSizes;
  labels: VirtualDeviceLabels;
}

const jwplcMap = jwplcRemoteIoPreset.map;

export const virtualDeviceTemplates: readonly VirtualDeviceTemplate[] = [
  {
    id: "generic",
    name: "Genérico",
    description: "64 posiciones de cada tipo, sin nombres.",
    unitId: 1,
    serial: null,
    sizes: { coils: 64, discreteInputs: 64, holdingRegisters: 64, inputRegisters: 64 },
    labels: {}
  },
  {
    // Mirrors the JWPLC_RemoteIO_Slave_RTU firmware: 8 outputs and 8 inputs, no registers.
    id: "jwplc-basic-remote-io",
    name: "JWPLC Basic Remote I/O",
    description: "Salidas Q0_0 a Q0_7 (FC01, FC05, FC15) y entradas I0_0 a I0_7 (FC02). Sin registros.",
    unitId: jwplcRemoteIoPreset.modbus.unitId,
    serial: {
      baudRate: jwplcRemoteIoPreset.serial.baudRate,
      dataBits: jwplcRemoteIoPreset.serial.dataBits,
      parity: jwplcRemoteIoPreset.serial.parity,
      stopBits: jwplcRemoteIoPreset.serial.stopBits
    },
    sizes: {
      coils: jwplcMap.outputFeedback.quantity,
      discreteInputs: jwplcMap.discreteInputs.quantity,
      holdingRegisters: 0,
      inputRegisters: 0
    },
    labels: {
      coils: [...jwplcMap.outputFeedback.labels],
      discreteInputs: [...jwplcMap.discreteInputs.labels]
    }
  }
];

export function findVirtualDeviceTemplate(id: string | null | undefined): VirtualDeviceTemplate | undefined {
  return virtualDeviceTemplates.find((template) => template.id === id);
}

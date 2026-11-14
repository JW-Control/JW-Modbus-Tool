#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Prueba de integración: el master de JW Modbus Tool (dist-electron, el mismo
// código que usa la app) contra el sketch Slave_JWSim_8FC corriendo en JWPLC
// Sim. Ver docs/PRUEBAS_JWPLC_SIM.md.
//
//   node scripts/sim/sim-integration.mjs --port <ruta> [--echo off|auto|on] [--rounds 50]
//
// Requiere `npm run build:main`. Sale con código 1 si algún paso falla.
import { serialManager } from "../../dist-electron/main/serial/serialManager.js";
import * as master from "../../dist-electron/main/modbus/rtuMasterActions.js";

const arg = (name, def) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? def : process.argv[i + 1];
};
const path = arg("--port");
const echo = arg("--echo", undefined);
const rounds = Number(arg("--rounds", 50));
const unitId = 2;
if (!path) {
  console.error("Falta --port <ruta>");
  process.exit(2);
}

const config = { path, baudRate: 115200, lock: false };
if (echo) config.echo = echo;
await serialManager.open(config);

const failures = [];
let steps = 0;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function step(name, run, check) {
  steps += 1;
  try {
    const result = await run();
    const problem = result.exception
      ? `excepción ${result.exception.exceptionName}`
      : !result.crcOk
        ? "CRC inválido"
        : check(result);
    if (problem) failures.push(`${name}: ${problem} (TX ${result.txHex} | RX ${result.rxHex})`);
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

for (let r = 0; r < rounds; r += 1) {
  const bits = Array.from({ length: 8 }, (_, i) => ((r >> (i % 3)) & 1) === 1);
  const regs = [r, 1000 + r, 65535 - r];
  await step("FC15", () => master.writeMultipleCoils({ unitId, startAddress: 0, values: bits }), () => null);
  await step("FC5", () => master.writeSingleCoil({ unitId, address: 7, value: r % 2 === 0 }), () => null);
  const expectedBits = [...bits.slice(0, 7), r % 2 === 0];
  await step("FC1", () => master.readCoils({ unitId, startAddress: 0, quantity: 8 }),
    (res) => (same(res.values, expectedBits) ? null : `coils ${JSON.stringify(res.values)}`));
  await step("FC2", () => master.readDiscreteInputs({ unitId, startAddress: 0, quantity: 8 }),
    (res) => (res.values?.length === 8 ? null : "sin 8 entradas"));
  await step("FC6", () => master.writeSingleRegister({ unitId, address: 1, value: 4242 + r }), () => null);
  await step("FC16", () => master.writeMultipleRegisters({ unitId, startAddress: 2, values: regs }), () => null);
  await step("FC3", () => master.readHoldingRegisters({ unitId, startAddress: 1, quantity: 4 }),
    (res) => (same(res.registerValues, [4242 + r, ...regs]) ? null : `HR ${JSON.stringify(res.registerValues)}`));
  await step("FC4", () => master.readInputRegisters({ unitId, startAddress: 0, quantity: 4 }),
    (res) => (same(res.registerValues, [1750, 2304, 4242, 65535]) ? null : `IR ${JSON.stringify(res.registerValues)}`));
}

await serialManager.close();
const state = serialManager.getConnectionState();
console.log(`${steps - failures.length}/${steps} pasos OK (echo=${echo ?? "por defecto"}${state.echoDetected !== undefined ? `, eco detectado=${state.echoDetected}` : ""})`);
for (const f of failures.slice(0, 8)) console.log("  FALLA", f);
if (failures.length > 8) console.log(`  … y ${failures.length - 8} fallas más`);
process.exit(failures.length ? 1 : 0);

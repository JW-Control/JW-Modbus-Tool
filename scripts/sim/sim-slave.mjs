#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Simulador slave de JW Modbus Tool (dist-electron, el mismo código que la
// vista Simulador) escuchando en un puerto serie, con un dispositivo virtual
// ID 2. Al otro lado: el sketch Master_JWSim_8FC en JWPLC Sim o en el JWPLC.
//
//   node scripts/sim/sim-slave.mjs --port <ruta> [--echo off|auto|on] [--seconds 20]
import { RtuSlaveSimulator } from "../../dist-electron/main/modbus/rtuSlaveSimulator.js";

const arg = (name, def) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? def : process.argv[i + 1];
};
const path = arg("--port");
const echo = arg("--echo", undefined);
const seconds = Number(arg("--seconds", 20));
if (!path) {
  console.error("Falta --port <ruta>");
  process.exit(2);
}

const simulator = new RtuSlaveSimulator();
simulator.addDevice({ unitId: 2, name: "Slave de prueba" });
const config = { path, baudRate: 115200, lock: false };
if (echo) config.echo = echo;
await simulator.start(config);
await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
const state = simulator.getState();
await simulator.stop();
console.log(JSON.stringify({ echo: echo ?? "por defecto", echoDetected: state.echoDetected, counters: state.counters }));

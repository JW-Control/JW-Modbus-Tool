import { formatAdu } from "../../shared/modbus/adu.js";
import { functionCodeName } from "../../shared/modbus/functionCodes.js";
import { decodeResponsePdu, encodeRequestPdu, type ModbusRequest } from "../../shared/modbus/pdu.js";
import { fromHex } from "../../shared/modbus/adu.js";
import {
  type ModbusCommand,
  type RawFrameCommand,
  type ReadCoilsCommand,
  type ReadDiscreteInputsCommand,
  type ReadHoldingRegistersCommand,
  type ReadInputRegistersCommand,
  type RtuMasterActionResult,
  type ValidationSequenceCommand,
  type ValidationSequenceResult,
  type ValidationStepResult,
  type WriteMultipleCoilsCommand,
  type WriteMultipleRegistersCommand,
  type WriteSingleCoilCommand,
  type WriteSingleRegisterCommand
} from "../../shared/modbus/masterActionTypes.js";
import { masterConnection, type MasterTransaction } from "./masterConnection.js";

const defaultTimeoutMs = 1000;

/**
 * Sends any supported request over the open connection (RTU, ASCII or TCP)
 * and decodes the reply. Timeouts and I/O errors are thrown; CRC/LRC errors,
 * exceptions and malformed replies come back in the result.
 */
export async function executeModbusRequest(command: ModbusCommand): Promise<RtuMasterActionResult> {
  const pdu = encodeRequestPdu(command.request);
  const transaction = await masterConnection.transactPdu(command.unitId, pdu, command.timeoutMs ?? defaultTimeoutMs);
  return interpret(command.unitId, command.request, transaction);
}

/** Sends a frame typed by the user in hex; see `RawFrameCommand`. */
export async function sendRawFrame(command: RawFrameCommand): Promise<RtuMasterActionResult> {
  const bytes = fromHex(command.hex);

  if (bytes.length === 0) {
    throw new Error("Escribe la trama en hexadecimal, por ejemplo 01 03 00 00 00 0A");
  }

  const transaction = await masterConnection.transactRaw(bytes, {
    addCheck: command.addCheck,
    timeoutMs: command.timeoutMs ?? defaultTimeoutMs
  });
  const { parsed } = transaction;
  const base = baseResult(parsed.unitId, transaction, parsed.pdu[0] ?? 0);

  if (!parsed.checkOk) {
    return { ...base, summary: parsed.checkError ?? "Trama inválida" };
  }

  const exception = parsed.pdu.length === 2 && (parsed.pdu[0] & 0x80) !== 0;
  return {
    ...base,
    summary: exception
      ? `Excepción ${parsed.pdu[1]} a FC${parsed.pdu[0] & 0x7f}`
      : `Respuesta FC${parsed.pdu[0]} (${functionCodeName(parsed.pdu[0])}), ${parsed.pdu.length} bytes de PDU`,
    exception: exception
      ? { functionCode: parsed.pdu[0] & 0x7f, exceptionCode: parsed.pdu[1], exceptionName: exceptionName(parsed.pdu[1]) }
      : undefined
  };
}

function interpret(unitId: number, request: ModbusRequest, transaction: MasterTransaction): RtuMasterActionResult {
  const { parsed } = transaction;
  const base = baseResult(unitId, transaction, parsed.pdu[0] ?? request.fc);

  if (!parsed.checkOk) {
    return { ...base, summary: parsed.checkError === "Error de LRC" ? "LRC error in response" : parsed.checkError === "Error de CRC" ? "CRC error in response" : parsed.checkError ?? "Invalid frame" };
  }

  if (unitId !== 0 && parsed.unitId !== unitId && transaction.framing !== "tcp") {
    return { ...base, crcOk: false, summary: `Responde el unit id ${parsed.unitId}, se esperaba ${unitId}` };
  }

  let decoded;

  try {
    decoded = decodeResponsePdu(request, parsed.pdu);
  } catch (error) {
    return { ...base, crcOk: false, checkError: error instanceof Error ? error.message : "Invalid response", summary: error instanceof Error ? error.message : "Invalid response" };
  }

  if (decoded.exception) {
    return { ...base, functionCode: decoded.exception.functionCode, summary: `Exception: ${decoded.exception.exceptionName}`, exception: decoded.exception };
  }

  return {
    ...base,
    summary: describe(request),
    values: decoded.bits,
    registerValues: decoded.registers,
    serverId: decoded.serverId,
    deviceId: decoded.deviceId
  };
}

function baseResult(unitId: number, transaction: MasterTransaction, functionCode: number): RtuMasterActionResult {
  return {
    timestamp: new Date().toISOString(),
    elapsedMs: transaction.elapsedMs,
    unitId,
    functionCode,
    summary: "",
    txHex: formatAdu(transaction.framing, transaction.request),
    rxHex: formatAdu(transaction.framing, transaction.response),
    crcOk: transaction.parsed.checkOk,
    checkError: transaction.parsed.checkError,
    framing: transaction.framing
  };
}

function describe(request: ModbusRequest): string {
  switch (request.fc) {
    case 1:
      return `FC1 Read Coils ${request.startAddress}:${request.quantity}`;
    case 2:
      return `FC2 Read Discrete Inputs ${request.startAddress}:${request.quantity}`;
    case 3:
      return `FC3 Read Holding Registers ${request.startAddress}:${request.quantity}`;
    case 4:
      return `FC4 Read Input Registers ${request.startAddress}:${request.quantity}`;
    case 5:
      return `FC5 Write Coil ${request.address} ${request.value ? "ON" : "OFF"}`;
    case 6:
      return `FC6 Write Register ${request.address}=${request.value}`;
    case 15:
      return `FC15 Write Coils ${request.startAddress}:${request.values.length}`;
    case 16:
      return `FC16 Write Registers ${request.startAddress}:${request.values.length}`;
    case 17:
      return "FC17 Report Server ID";
    case 22:
      return `FC22 Mask Write ${request.address} AND 0x${hex4(request.andMask)} OR 0x${hex4(request.orMask)}`;
    case 23:
      return `FC23 Read ${request.readStartAddress}:${request.readQuantity} / Write ${request.writeStartAddress}:${request.values.length}`;
    case 43:
      return `FC43/14 Read Device Identification (código ${request.readDeviceIdCode})`;
  }
}

function hex4(value: number): string {
  return value.toString(16).toUpperCase().padStart(4, "0");
}

function exceptionName(code: number): string {
  return ["", "Illegal Function", "Illegal Data Address", "Illegal Data Value", "Slave Device Failure"][code] ?? `Exception ${code}`;
}

export function readCoils(command: ReadCoilsCommand): Promise<RtuMasterActionResult> {
  return executeModbusRequest({ unitId: command.unitId, timeoutMs: command.timeoutMs, request: { fc: 1, startAddress: command.startAddress, quantity: command.quantity } });
}

export function readDiscreteInputs(command: ReadDiscreteInputsCommand): Promise<RtuMasterActionResult> {
  return executeModbusRequest({ unitId: command.unitId, timeoutMs: command.timeoutMs, request: { fc: 2, startAddress: command.startAddress, quantity: command.quantity } });
}

export function readHoldingRegisters(command: ReadHoldingRegistersCommand): Promise<RtuMasterActionResult> {
  return executeModbusRequest({ unitId: command.unitId, timeoutMs: command.timeoutMs, request: { fc: 3, startAddress: command.startAddress, quantity: command.quantity } });
}

export function readInputRegisters(command: ReadInputRegistersCommand): Promise<RtuMasterActionResult> {
  return executeModbusRequest({ unitId: command.unitId, timeoutMs: command.timeoutMs, request: { fc: 4, startAddress: command.startAddress, quantity: command.quantity } });
}

export function writeSingleCoil(command: WriteSingleCoilCommand): Promise<RtuMasterActionResult> {
  return executeModbusRequest({ unitId: command.unitId, timeoutMs: command.timeoutMs, request: { fc: 5, address: command.address, value: command.value } });
}

export function writeSingleRegister(command: WriteSingleRegisterCommand): Promise<RtuMasterActionResult> {
  return executeModbusRequest({ unitId: command.unitId, timeoutMs: command.timeoutMs, request: { fc: 6, address: command.address, value: command.value } });
}

export function writeMultipleCoils(command: WriteMultipleCoilsCommand): Promise<RtuMasterActionResult> {
  return executeModbusRequest({ unitId: command.unitId, timeoutMs: command.timeoutMs, request: { fc: 15, startAddress: command.startAddress, values: command.values } });
}

export function writeMultipleRegisters(command: WriteMultipleRegistersCommand): Promise<RtuMasterActionResult> {
  return executeModbusRequest({ unitId: command.unitId, timeoutMs: command.timeoutMs, request: { fc: 16, startAddress: command.startAddress, values: command.values } });
}

export async function runJwplcValidationSequence(
  command: ValidationSequenceCommand
): Promise<ValidationSequenceResult> {
  const timeoutMs = command.timeoutMs ?? defaultTimeoutMs;
  const steps: ValidationStepResult[] = [];

  const readInputs = await readDiscreteInputs({
    unitId: command.unitId,
    startAddress: 0,
    quantity: 8,
    timeoutMs
  });
  steps.push(toStep("Read inputs FC2", readInputs.crcOk && !readInputs.exception, "FC2 start 0 quantity 8", readInputs));

  const q0On = await writeSingleCoil({ unitId: command.unitId, address: 0, value: true, timeoutMs });
  steps.push(toStep("Write Q0_0 ON", q0On.crcOk && !q0On.exception, "FC5 address 0 value ON", q0On));

  const feedbackOn = await readCoils({ unitId: command.unitId, startAddress: 0, quantity: 8, timeoutMs });
  steps.push(
    toStep(
      "Verify Q0_0 ON",
      feedbackOn.crcOk && !feedbackOn.exception && feedbackOn.values?.[0] === true,
      "FC1 feedback Q0_0 expected ON",
      feedbackOn
    )
  );

  const q0Off = await writeSingleCoil({ unitId: command.unitId, address: 0, value: false, timeoutMs });
  steps.push(toStep("Write Q0_0 OFF", q0Off.crcOk && !q0Off.exception, "FC5 address 0 value OFF", q0Off));

  const pattern55Values = bitPattern(0x55, 8);
  const pattern55 = await writeMultipleCoils({
    unitId: command.unitId,
    startAddress: 0,
    values: pattern55Values,
    timeoutMs
  });
  steps.push(toStep("Write pattern 0x55", pattern55.crcOk && !pattern55.exception, "FC15 start 0 quantity 8", pattern55));

  const feedback55 = await readCoils({ unitId: command.unitId, startAddress: 0, quantity: 8, timeoutMs });
  steps.push(
    toStep(
      "Verify pattern 0x55",
      feedback55.crcOk && !feedback55.exception && sameBits(feedback55.values, pattern55Values),
      "FC1 feedback expected 0x55",
      feedback55
    )
  );

  const allOffValues = bitPattern(0x00, 8);
  const allOff = await writeMultipleCoils({
    unitId: command.unitId,
    startAddress: 0,
    values: allOffValues,
    timeoutMs
  });
  steps.push(toStep("Write all outputs OFF", allOff.crcOk && !allOff.exception, "FC15 start 0 quantity 8 value 0x00", allOff));

  const feedbackOff = await readCoils({ unitId: command.unitId, startAddress: 0, quantity: 8, timeoutMs });
  steps.push(
    toStep(
      "Verify all outputs OFF",
      feedbackOff.crcOk && !feedbackOff.exception && sameBits(feedbackOff.values, allOffValues),
      "FC1 feedback expected 0x00",
      feedbackOff
    )
  );

  const passed = steps.every((step) => step.passed);
  const summary = passed ? "PASS - JWPLC validation sequence completed" : "FAIL - JWPLC validation sequence found errors";

  return {
    timestamp: new Date().toISOString(),
    passed,
    summary,
    steps,
    markdown: buildValidationMarkdown(command.unitId, summary, steps)
  };
}

function toStep(
  name: string,
  passed: boolean,
  details: string,
  action: RtuMasterActionResult
): ValidationStepResult {
  return {
    name,
    passed,
    details,
    action
  };
}

function bitPattern(pattern: number, quantity: number): boolean[] {
  return Array.from({ length: quantity }, (_, index) => (pattern & (1 << index)) !== 0);
}

function sameBits(left: boolean[] | undefined, right: boolean[]): boolean {
  return Boolean(left && left.length >= right.length && right.every((value, index) => left[index] === value));
}

function formatRegisterValue(value: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(4, "0")}`;
}

function buildValidationMarkdown(unitId: number, summary: string, steps: ValidationStepResult[]): string {
  const lines = [
    "# JWPLC Basic Remote I/O Validation",
    "",
    `- Date: ${new Date().toISOString()}`,
    `- Slave ID: ${unitId}`,
    `- Result: ${summary}`,
    "",
    "| Step | Result | Details |",
    "| --- | --- | --- |",
    ...steps.map((step) => `| ${step.name} | ${step.passed ? "PASS" : "FAIL"} | ${step.details} |`),
    "",
    "## Frames",
    "",
    ...steps.flatMap((step) => [
      `### ${step.name}`,
      "",
      `- TX: \`${step.action.txHex}\``,
      `- RX: \`${step.action.rxHex}\``,
      `- CRC: ${step.action.crcOk ? "OK" : "ERROR"}`,
      ""
    ])
  ];

  return lines.join("\n");
}

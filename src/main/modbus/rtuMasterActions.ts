import { formatHex } from "../../shared/modbus/byteUtils.js";
import { decodeExceptionResponse } from "../../shared/modbus/rtuFrame.js";
import { expectedRtuResponseLength } from "../../shared/modbus/rtuResponseLength.js";
import {
  decodeBitReadResponse,
  decodeRegisterReadResponse,
  encodeReadCoilsRequest,
  encodeReadDiscreteInputsRequest,
  encodeReadHoldingRegistersRequest,
  encodeReadInputRegistersRequest,
  encodeWriteMultipleRegistersRequest,
  encodeWriteMultipleCoilsRequest,
  encodeWriteSingleRegisterRequest,
  encodeWriteSingleCoilRequest
} from "../../shared/modbus/masterRequests.js";
import {
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
import { parseRtuFrame } from "../../shared/modbus/rtuFrame.js";
import { serialManager } from "../serial/serialManager.js";

const defaultTimeoutMs = 1000;

export async function readCoils(command: ReadCoilsCommand): Promise<RtuMasterActionResult> {
  const request = encodeReadCoilsRequest(command);
  const transaction = await serialManager.transact(request, {
    timeoutMs: command.timeoutMs ?? defaultTimeoutMs,
    expectedResponseLength: expectedRtuResponseLength
  });
  const parsed = parseRtuFrame(transaction.response);
  const exception = decodeExceptionResponse(transaction.response);

  if (exception) {
    return buildBaseResult(command.unitId, transaction, `Exception: ${exception.exceptionName}`, {
      functionCode: exception.functionCode,
      exceptionCode: exception.exceptionCode,
      exceptionName: exception.exceptionName
    });
  }

  const decoded = decodeBitReadResponse(transaction.response, command.quantity);
  return buildBaseResult(
    command.unitId,
    transaction,
    `FC1 Read Coils ${command.startAddress}:${command.quantity}`,
    undefined,
    parsed.functionCode,
    decoded.values
  );
}

export async function readDiscreteInputs(
  command: ReadDiscreteInputsCommand
): Promise<RtuMasterActionResult> {
  const request = encodeReadDiscreteInputsRequest(command);
  const transaction = await serialManager.transact(request, {
    timeoutMs: command.timeoutMs ?? defaultTimeoutMs,
    expectedResponseLength: expectedRtuResponseLength
  });
  const parsed = parseRtuFrame(transaction.response);
  const exception = decodeExceptionResponse(transaction.response);

  if (exception) {
    return buildBaseResult(command.unitId, transaction, `Exception: ${exception.exceptionName}`, {
      functionCode: exception.functionCode,
      exceptionCode: exception.exceptionCode,
      exceptionName: exception.exceptionName
    });
  }

  const decoded = decodeBitReadResponse(transaction.response, command.quantity);
  return buildBaseResult(
    command.unitId,
    transaction,
    `FC2 Read Discrete Inputs ${command.startAddress}:${command.quantity}`,
    undefined,
    parsed.functionCode,
    decoded.values
  );
}

export async function readHoldingRegisters(
  command: ReadHoldingRegistersCommand
): Promise<RtuMasterActionResult> {
  const request = encodeReadHoldingRegistersRequest(command);
  const transaction = await serialManager.transact(request, {
    timeoutMs: command.timeoutMs ?? defaultTimeoutMs,
    expectedResponseLength: expectedRtuResponseLength
  });
  const parsed = parseRtuFrame(transaction.response);
  const exception = decodeExceptionResponse(transaction.response);

  if (exception) {
    return buildBaseResult(command.unitId, transaction, `Exception: ${exception.exceptionName}`, {
      functionCode: exception.functionCode,
      exceptionCode: exception.exceptionCode,
      exceptionName: exception.exceptionName
    });
  }

  const decoded = decodeRegisterReadResponse(transaction.response);
  return buildBaseResult(
    command.unitId,
    transaction,
    `FC3 Read Holding Registers ${command.startAddress}:${command.quantity}`,
    undefined,
    parsed.functionCode,
    undefined,
    decoded.values
  );
}

export async function readInputRegisters(
  command: ReadInputRegistersCommand
): Promise<RtuMasterActionResult> {
  const request = encodeReadInputRegistersRequest(command);
  const transaction = await serialManager.transact(request, {
    timeoutMs: command.timeoutMs ?? defaultTimeoutMs,
    expectedResponseLength: expectedRtuResponseLength
  });
  const parsed = parseRtuFrame(transaction.response);
  const exception = decodeExceptionResponse(transaction.response);

  if (exception) {
    return buildBaseResult(command.unitId, transaction, `Exception: ${exception.exceptionName}`, {
      functionCode: exception.functionCode,
      exceptionCode: exception.exceptionCode,
      exceptionName: exception.exceptionName
    });
  }

  const decoded = decodeRegisterReadResponse(transaction.response);
  return buildBaseResult(
    command.unitId,
    transaction,
    `FC4 Read Input Registers ${command.startAddress}:${command.quantity}`,
    undefined,
    parsed.functionCode,
    undefined,
    decoded.values
  );
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

export async function writeSingleCoil(
  command: WriteSingleCoilCommand
): Promise<RtuMasterActionResult> {
  const request = encodeWriteSingleCoilRequest(command);
  const transaction = await serialManager.transact(request, {
    timeoutMs: command.timeoutMs ?? defaultTimeoutMs,
    expectedResponseLength: expectedRtuResponseLength
  });
  const parsed = parseRtuFrame(transaction.response);
  const exception = decodeExceptionResponse(transaction.response);

  if (exception) {
    return buildBaseResult(command.unitId, transaction, `Exception: ${exception.exceptionName}`, {
      functionCode: exception.functionCode,
      exceptionCode: exception.exceptionCode,
      exceptionName: exception.exceptionName
    });
  }

  return buildBaseResult(
    command.unitId,
    transaction,
    `FC5 Write Coil ${command.address} ${command.value ? "ON" : "OFF"}`,
    undefined,
    parsed.functionCode
  );
}

export async function writeSingleRegister(
  command: WriteSingleRegisterCommand
): Promise<RtuMasterActionResult> {
  const request = encodeWriteSingleRegisterRequest(command);
  const transaction = await serialManager.transact(request, {
    timeoutMs: command.timeoutMs ?? defaultTimeoutMs,
    expectedResponseLength: expectedRtuResponseLength
  });
  const parsed = parseRtuFrame(transaction.response);
  const exception = decodeExceptionResponse(transaction.response);

  if (exception) {
    return buildBaseResult(command.unitId, transaction, `Exception: ${exception.exceptionName}`, {
      functionCode: exception.functionCode,
      exceptionCode: exception.exceptionCode,
      exceptionName: exception.exceptionName
    });
  }

  return buildBaseResult(
    command.unitId,
    transaction,
    `FC6 Write Register ${command.address} = ${formatRegisterValue(command.value)}`,
    undefined,
    parsed.functionCode
  );
}

export async function writeMultipleCoils(
  command: WriteMultipleCoilsCommand
): Promise<RtuMasterActionResult> {
  const request = encodeWriteMultipleCoilsRequest(command);
  const transaction = await serialManager.transact(request, {
    timeoutMs: command.timeoutMs ?? defaultTimeoutMs,
    expectedResponseLength: expectedRtuResponseLength
  });
  const parsed = parseRtuFrame(transaction.response);
  const exception = decodeExceptionResponse(transaction.response);

  if (exception) {
    return buildBaseResult(command.unitId, transaction, `Exception: ${exception.exceptionName}`, {
      functionCode: exception.functionCode,
      exceptionCode: exception.exceptionCode,
      exceptionName: exception.exceptionName
    });
  }

  return buildBaseResult(
    command.unitId,
    transaction,
    `FC15 Write Coils ${command.startAddress}:${command.values.length}`,
    undefined,
    parsed.functionCode
  );
}

export async function writeMultipleRegisters(
  command: WriteMultipleRegistersCommand
): Promise<RtuMasterActionResult> {
  const request = encodeWriteMultipleRegistersRequest(command);
  const transaction = await serialManager.transact(request, {
    timeoutMs: command.timeoutMs ?? defaultTimeoutMs,
    expectedResponseLength: expectedRtuResponseLength
  });
  const parsed = parseRtuFrame(transaction.response);
  const exception = decodeExceptionResponse(transaction.response);

  if (exception) {
    return buildBaseResult(command.unitId, transaction, `Exception: ${exception.exceptionName}`, {
      functionCode: exception.functionCode,
      exceptionCode: exception.exceptionCode,
      exceptionName: exception.exceptionName
    });
  }

  return buildBaseResult(
    command.unitId,
    transaction,
    `FC16 Write Registers ${command.startAddress}:${command.values.length}`,
    undefined,
    parsed.functionCode
  );
}

interface SerialTransactionShape {
  request: Uint8Array;
  response: Uint8Array;
  elapsedMs: number;
}

function buildBaseResult(
  unitId: number,
  transaction: SerialTransactionShape,
  summary: string,
  exception?: RtuMasterActionResult["exception"],
  functionCode = 0,
  values?: boolean[],
  registerValues?: number[]
): RtuMasterActionResult {
  const parsed = parseRtuFrame(transaction.response);

  return {
    timestamp: new Date().toISOString(),
    elapsedMs: transaction.elapsedMs,
    unitId,
    functionCode: functionCode || exception?.functionCode || parsed.functionCode,
    summary,
    txHex: formatHex(transaction.request),
    rxHex: formatHex(transaction.response),
    crcOk: parsed.crcOk,
    values,
    registerValues,
    exception
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

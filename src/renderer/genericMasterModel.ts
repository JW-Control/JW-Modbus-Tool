export type GenericFunction = "fc1" | "fc2" | "fc3" | "fc4" | "fc5" | "fc6" | "fc15" | "fc16";

export interface GenericCommandInput {
  functionCode: GenericFunction;
  unitId: number;
  startAddress: number;
  quantity: number;
  registerValue: string;
  valuesText: string;
}

export const genericFunctionOptions: Array<{ value: GenericFunction; label: string }> = [
  { value: "fc1", label: "FC1 Leer bobinas" },
  { value: "fc2", label: "FC2 Leer entradas discretas" },
  { value: "fc3", label: "FC3 Leer holding registers" },
  { value: "fc4", label: "FC4 Leer input registers" },
  { value: "fc5", label: "FC5 Escribir una bobina" },
  { value: "fc6", label: "FC6 Escribir un registro" },
  { value: "fc15", label: "FC15 Escribir múltiples bobinas" },
  { value: "fc16", label: "FC16 Escribir múltiples registros" }
];

export function isReadFunction(functionCode: GenericFunction): boolean {
  return functionCode === "fc1" || functionCode === "fc2" || functionCode === "fc3" || functionCode === "fc4";
}

export function isBitReadFunction(functionCode: GenericFunction): boolean {
  return functionCode === "fc1" || functionCode === "fc2";
}

export function isSingleWriteFunction(functionCode: GenericFunction): boolean {
  return functionCode === "fc5" || functionCode === "fc6";
}

export function readQuantityMax(functionCode: GenericFunction): number {
  return isBitReadFunction(functionCode) ? 2000 : 125;
}

export function parseRegisterValue(value: string): number {
  return Number(value.trim());
}

export function parseRegisterValues(value: string): number[] {
  return splitValues(value).map(parseRegisterValue);
}

export function parseCoilValues(value: string): boolean[] {
  return splitValues(value).map((token) => {
    switch (token.toLowerCase()) {
      case "1":
      case "on":
      case "true":
        return true;
      case "0":
      case "off":
      case "false":
        return false;
      default:
        throw new Error(`Valor de bobina inválido: ${token}`);
    }
  });
}

export function validateGenericCommand(input: GenericCommandInput): string | null {
  if (!Number.isInteger(input.unitId) || input.unitId < 1 || input.unitId > 247) {
    return "El ID de unidad debe ser un entero entre 1 y 247";
  }

  if (!Number.isInteger(input.startAddress) || input.startAddress < 0 || input.startAddress > 65535) {
    return "La dirección debe ser un entero entre 0 y 65535";
  }

  if (isReadFunction(input.functionCode)) {
    const maximum = readQuantityMax(input.functionCode);
    if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > maximum) {
      return `La cantidad de lectura debe ser un entero entre 1 y ${maximum}`;
    }

    if (input.startAddress + input.quantity > 65536) {
      return "El rango de lectura excede la dirección 65535";
    }
  }

  if (
    input.functionCode === "fc6" &&
    (input.registerValue.trim().length === 0 || !isUint16(parseRegisterValue(input.registerValue)))
  ) {
    return "El valor del registro debe estar entre 0 y 65535";
  }

  if (input.functionCode === "fc15") {
    let values: boolean[];

    try {
      values = parseCoilValues(input.valuesText);
    } catch {
      return "FC15 requiere valores 1/0, ON/OFF o true/false";
    }

    if (values.length < 1 || values.length > 1968) {
      return "FC15 requiere entre 1 y 1968 valores de bobina";
    }

    if (input.startAddress + values.length > 65536) {
      return "El rango FC15 excede la dirección 65535";
    }
  }

  if (input.functionCode === "fc16") {
    const values = parseRegisterValues(input.valuesText);
    if (values.length < 1 || values.length > 123 || values.some((item) => !isUint16(item))) {
      return "FC16 requiere entre 1 y 123 valores de 0 a 65535";
    }

    if (input.startAddress + values.length > 65536) {
      return "El rango FC16 excede la dirección 65535";
    }
  }

  return null;
}

export function isGenericFunction(value: unknown): value is GenericFunction {
  return genericFunctionOptions.some((option) => option.value === value);
}

function splitValues(value: string): string[] {
  return value.split(/[\s,;]+/).filter(Boolean);
}

function isUint16(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 65535;
}

// Numeración de direcciones que ve el usuario. En la trama siempre viaja la
// dirección de protocolo (desde 0); aquí solo cambia cómo se muestra y se
// escribe en la app.

export type AddressMode = "jw" | "protocol" | "one" | "modicon";
export type TableFn = 1 | 2 | 3 | 4;

export const addressModes: AddressMode[] = ["jw", "protocol", "one", "modicon"];

export const addressModeLabels: Record<AddressMode, string> = {
  jw: "4xxxx desde 40000 (= registro 0)",
  protocol: "Base 0 (dirección de protocolo)",
  one: "Base 1 (1 = registro 0)",
  modicon: "Modicon 4xxxx desde 40001"
};

/** What the user types or sees for protocol address 0 of each table. */
export function addressOffset(mode: AddressMode, fn: TableFn): number {
  switch (mode) {
    case "protocol":
      return 0;
    case "one":
      return 1;
    case "modicon":
      return fn === 1 ? 1 : fn === 2 ? 10001 : fn === 4 ? 30001 : 40001;
    case "jw":
      return fn === 1 ? 0 : fn === 2 ? 10000 : fn === 4 ? 30000 : 40000;
  }
}

export function toDisplayAddress(mode: AddressMode, fn: TableFn, raw: number): number {
  return raw + addressOffset(mode, fn);
}

/** Protocol address for what the user typed; throws RangeError when it is outside the table. */
export function toProtocolAddress(mode: AddressMode, fn: TableFn, display: number): number {
  const offset = addressOffset(mode, fn);
  const raw = display - offset;
  if (!Number.isInteger(display) || raw < 0 || raw > 0xffff) {
    throw new RangeError(`La dirección debe estar entre ${offset} y ${offset + 0xffff}`);
  }
  return raw;
}

export function isAddressMode(value: unknown): value is AddressMode {
  return typeof value === "string" && (addressModes as string[]).includes(value);
}

/** Table of a function code for address purposes (writes use their read table). */
export function tableOf(fc: number): TableFn {
  if (fc === 1 || fc === 5 || fc === 15) return 1;
  if (fc === 2) return 2;
  if (fc === 4) return 4;
  return 3;
}

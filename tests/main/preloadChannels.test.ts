// La app carga src/preload/preload.cjs (escrito a mano); preload.ts da los
// tipos. Si uno expone un canal IPC que el otro no tiene, la UI falla en
// ejecución aunque el typecheck pase.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const channels = (file: string) =>
  [...new Set(readFileSync(new URL(`../../src/preload/${file}`, import.meta.url), "utf8").match(/"[a-z]+:[A-Za-z]+"/g) ?? [])].sort();

describe("preload", () => {
  it("preload.cjs y preload.ts exponen los mismos canales IPC", () => {
    expect(channels("preload.cjs")).toEqual(channels("preload.ts"));
    expect(channels("preload.cjs")).toContain('"modbus:execute"');
  });
});

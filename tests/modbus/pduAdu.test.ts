import { describe, expect, it } from "vitest";
import {
  buildAsciiAdu,
  buildMbapAdu,
  buildRtuAdu,
  expectedAduLength,
  lrc,
  parseAsciiAdu,
  parseMbapAdu,
  parseRtuAdu
} from "../../src/shared/modbus/adu.js";
import { decodeResponsePdu, encodeRequestPdu, expectedResponsePduLength } from "../../src/shared/modbus/pdu.js";
import { AsciiFramer, MbapFramer } from "../../src/shared/modbus/streamFramers.js";

const bytes = (hex: string) => Uint8Array.from(hex.split(/\s+/).filter(Boolean).map((h) => parseInt(h, 16)));

describe("PDU de las funciones nuevas", () => {
  it("FC22 Mask Write Register, ejemplo de la especificación", () => {
    // Spec example: address 4, AND 0x00F2, OR 0x0025.
    expect(encodeRequestPdu({ fc: 22, address: 4, andMask: 0x00f2, orMask: 0x0025 })).toEqual(bytes("16 00 04 00 F2 00 25"));
    expect(decodeResponsePdu({ fc: 22, address: 4, andMask: 0x00f2, orMask: 0x0025 }, bytes("16 00 04 00 F2 00 25"))).toEqual({ functionCode: 22 });
  });

  it("FC23 Read/Write Multiple Registers, ejemplo de la especificación", () => {
    const request = { fc: 23 as const, readStartAddress: 3, readQuantity: 6, writeStartAddress: 14, values: [0x00ff, 0x00ff, 0x00ff] };
    expect(encodeRequestPdu(request)).toEqual(bytes("17 00 03 00 06 00 0E 00 03 06 00 FF 00 FF 00 FF"));
    const response = bytes("17 0C 00 FE 0A CD 00 01 00 03 00 0D 00 FF");
    expect(expectedResponsePduLength(response)).toBe(14);
    expect(decodeResponsePdu(request, response).registers).toEqual([0x00fe, 0x0acd, 0x0001, 0x0003, 0x000d, 0x00ff]);
  });

  it("FC17 Report Server ID", () => {
    const response = bytes("11 07 02 FF 4A 57 20 31 2E 30").slice(0, 9);
    const decoded = decodeResponsePdu({ fc: 17 }, response);
    expect(decoded.serverId).toMatchObject({ serverId: 2, running: true, text: "JW 1." });
  });

  it("FC43/14 Read Device Identification, con la longitud recorrida objeto por objeto", () => {
    expect(encodeRequestPdu({ fc: 43, readDeviceIdCode: 1, objectId: 0 })).toEqual(bytes("2B 0E 01 00"));
    const response = bytes("2B 0E 01 01 00 00 03 00 02 4A 57 01 03 41 42 43 02 03 31 2E 30");
    expect(expectedResponsePduLength(response.slice(0, 10))).toBeNull();
    expect(expectedResponsePduLength(response)).toBe(response.length);
    expect(decodeResponsePdu({ fc: 43, readDeviceIdCode: 1, objectId: 0 }, response).deviceId?.objects).toEqual([
      { id: 0, name: "VendorName", value: "JW" },
      { id: 1, name: "ProductCode", value: "ABC" },
      { id: 2, name: "MajorMinorRevision", value: "1.0" }
    ]);
  });

  it("FC43 lee texto UTF-8 y, si no lo es, Latin-1", () => {
    // ModelName "Gené" en UTF-8 (C3 A9) y "Gené" en Latin-1 (E9).
    const utf8 = bytes("2B 0E 02 01 00 00 01 05 05 47 65 6E C3 A9");
    const latin1 = bytes("2B 0E 02 01 00 00 01 05 04 47 65 6E E9");
    expect(decodeResponsePdu({ fc: 43, readDeviceIdCode: 2, objectId: 0 }, utf8).deviceId?.objects[0].value).toBe("Gené");
    expect(decodeResponsePdu({ fc: 43, readDeviceIdCode: 2, objectId: 0 }, latin1).deviceId?.objects[0].value).toBe("Gené");
  });

  it("rechaza una respuesta de otra función o con el byte count mal", () => {
    expect(() => decodeResponsePdu({ fc: 3, startAddress: 0, quantity: 2 }, bytes("04 04 00 01 00 02"))).toThrow("FC4");
    expect(() => decodeResponsePdu({ fc: 3, startAddress: 0, quantity: 2 }, bytes("03 02 00 01"))).toThrow("bytes de registros");
  });
});

describe("envolturas RTU, ASCII y TCP", () => {
  const pdu = bytes("03 00 00 00 0A");

  it("RTU agrega unit id y CRC", () => {
    const frame = buildRtuAdu(1, pdu);
    expect(frame).toEqual(bytes("01 03 00 00 00 0A C5 CD"));
    expect(parseRtuAdu(frame)).toMatchObject({ unitId: 1, pdu, checkOk: true });
    frame[7] ^= 1;
    expect(parseRtuAdu(frame).checkError).toBe("Error de CRC");
  });

  it("ASCII usa ':' + hex + LRC + CR LF", () => {
    expect(lrc(bytes("01 03 00 00 00 0A"))).toBe(0xf2);
    const frame = buildAsciiAdu(1, pdu);
    expect(new TextDecoder().decode(frame)).toBe(":01030000000AF2\r\n");
    expect(parseAsciiAdu(frame)).toMatchObject({ unitId: 1, pdu, checkOk: true });
    expect(parseAsciiAdu(new TextEncoder().encode(":01030000000AF3\r\n")).checkError).toBe("Error de LRC");
    expect(expectedAduLength("ascii", new TextEncoder().encode(":0103"), "response")).toBeNull();
  });

  it("TCP antepone la cabecera MBAP", () => {
    const frame = buildMbapAdu(0x1234, 1, pdu);
    expect(frame).toEqual(bytes("12 34 00 00 00 06 01 03 00 00 00 0A"));
    expect(parseMbapAdu(frame)).toMatchObject({ unitId: 1, pdu, checkOk: true, transactionId: 0x1234 });
    expect(expectedAduLength("tcp", frame.slice(0, 6), "response")).toBe(12);
    const bad = frame.slice();
    bad[2] = 0xff;
    expect(parseMbapAdu(bad).checkOk).toBe(false);
  });

  it("los separadores de flujo cortan ASCII por CR LF y TCP por longitud", () => {
    const ascii = new AsciiFramer();
    const text = new TextEncoder().encode("ruido:01030000000AF2\r\n:0106");
    expect(ascii.push(text).map((f) => new TextDecoder().decode(f))).toEqual([":01030000000AF2\r\n"]);
    expect(ascii.push(new TextEncoder().encode("0001000AEE\r\n")).length).toBe(1);

    const mbap = new MbapFramer();
    const two = new Uint8Array([...buildMbapAdu(1, 1, pdu), ...buildMbapAdu(2, 1, pdu)]);
    expect(mbap.push(two.slice(0, 15))).toHaveLength(1);
    expect(mbap.push(two.slice(15))).toHaveLength(1);
  });
});

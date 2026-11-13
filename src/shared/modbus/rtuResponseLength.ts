import { expectedResponsePduLength } from "./pdu.js";

/** Length of a whole RTU response (unit id + PDU + CRC) from its first bytes, or null while unknown. */
export function expectedRtuResponseLength(bytes: Uint8Array): number | null {
  if (bytes.length < 2) {
    return null;
  }

  const pduLength = expectedResponsePduLength(bytes.subarray(1));
  return pduLength === null ? null : 1 + pduLength + 2;
}

export type BusDirection = "tx" | "rx" | "internal";

export interface BusLogEntry {
  id: string;
  timestamp: string;
  direction: BusDirection;
  hex: string;
  summary: string;
  crcStatus?: "ok" | "error" | "not-applicable";
  exceptionCode?: number;
}

import { describe, expect, it } from "vitest";
import { appendTrend, trendKey, trendPolyline, trendStats, type TrendPoint } from "../../src/renderer/registerTrend.js";

describe("tendencia de registros", () => {
  it("guarda cada lectura por registro y descarta lo que pasa de 60 s", () => {
    const history = new Map<string, TrendPoint[]>();
    appendTrend(history, [{ address: "40000", value: "0" }, { address: "40001", value: "1234" }], "1", 0);
    appendTrend(history, [{ address: "40000", value: "10" }], "1", 30_000);
    appendTrend(history, [{ address: "40000", value: "20" }], "1", 70_000);
    expect(history.get(trendKey("1", "40000"))!.map((p) => p.value)).toEqual([10, 20]);
    expect(history.get(trendKey("1", "40001"))!.map((p) => p.value)).toEqual([1234]);
  });

  it("no mezcla registros ni slaves en las estadísticas", () => {
    const history = new Map<string, TrendPoint[]>();
    appendTrend(history, [{ address: "40000", value: "0" }, { address: "40001", value: "1234" }], "1", 0);
    appendTrend(history, [{ address: "40000", value: "500" }], "2", 0);
    expect(trendStats(history.get(trendKey("1", "40000"))!)).toEqual({ min: "0", max: "0", avg: "0" });
  });

  it("cuenta bits ON/OFF como 1/0 e ignora valores no numéricos", () => {
    const history = new Map<string, TrendPoint[]>();
    appendTrend(history, [{ address: "1", value: "ON" }, { address: "2", value: "—" }], "1", 0);
    appendTrend(history, [{ address: "1", value: "OFF" }], "1", 1000);
    expect(trendStats(history.get(trendKey("1", "1"))!)).toEqual({ min: "0", max: "1", avg: "0.50" });
    expect(history.has(trendKey("1", "2"))).toBe(false);
  });

  it("dibuja la línea en la ventana de 60 s", () => {
    expect(trendPolyline([])).toBe("");
    expect(trendPolyline([{ at: 0, value: 5 }])).toBe("0,60 400,60");
    expect(trendPolyline([{ at: 0, value: 0 }, { at: 30_000, value: 100 }])).toBe("200,110 400,10");
  });
});

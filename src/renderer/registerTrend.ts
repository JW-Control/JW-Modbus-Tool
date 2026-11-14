// Historial corto de valores por registro para la tarjeta "Registro seleccionado".
// Cada lectura (manual o automática) agrega un punto; se guardan los últimos 60 s.

export interface TrendPoint { at: number; value: number }
export interface TrendStats { min: string; max: string; avg: string }

export const TREND_WINDOW_MS = 60_000;

export function trendValue(raw: string): number | null {
  if (raw === "ON") return 1;
  if (raw === "OFF") return 0;
  const value = Number(raw);
  return raw.trim() !== "" && Number.isFinite(value) ? value : null;
}

export function appendTrend(
  history: Map<string, TrendPoint[]>,
  rows: ReadonlyArray<{ address: string; value: string }>,
  scope: string,
  at: number,
  windowMs = TREND_WINDOW_MS,
): void {
  for (const row of rows) {
    const value = trendValue(row.value);
    if (value === null) continue;
    const key = trendKey(scope, row.address);
    const points = (history.get(key) ?? []).filter((point) => at - point.at <= windowMs);
    points.push({ at, value });
    history.set(key, points);
  }
}

export function trendKey(scope: string, address: string): string {
  return `${scope}:${address}`;
}

export function trendStats(points: ReadonlyArray<TrendPoint>): TrendStats {
  if (points.length === 0) return { min: "—", max: "—", avg: "—" };
  const values = points.map((point) => point.value);
  const avg = values.reduce((total, value) => total + value, 0) / values.length;
  return { min: format(Math.min(...values)), max: format(Math.max(...values)), avg: format(avg) };
}

// Puntos para un <polyline> de width x height: el eje X cubre la ventana de 60 s
// que termina en el último punto; el eje Y se ajusta al rango de valores.
export function trendPolyline(points: ReadonlyArray<TrendPoint>, width = 400, height = 120, windowMs = TREND_WINDOW_MS): string {
  if (points.length === 0) return "";
  const end = points[points.length - 1].at;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = 10;
  const y = (value: number) => (max === min ? height / 2 : pad + (1 - (value - min) / (max - min)) * (height - 2 * pad));
  const x = (at: number) => Math.max(0, width - ((end - at) / windowMs) * width);
  const coords = points.map((point) => `${round(x(point.at))},${round(y(point.value))}`);
  if (points.length === 1) coords.unshift(`0,${round(y(points[0].value))}`);
  return coords.join(" ");
}

function format(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

import { readFileSync } from "node:fs";
import path from "node:path";

// Open-Meteo: free, no key. Data is CC BY 4.0, so the attribution travels with every reading.

export type Uv = {
  city: string;
  country: string;
  lat: number;
  lon: number;
  uvMax: number;
  date: string;
  source: "live" | "recorded";
  attribution: string;
};

export class UvError extends Error {
  constructor(public kind: "city_not_found" | "uv_unavailable") {
    super(kind); // never raw exception text
    this.name = "UvError";
  }
}

export type UvOpts = { fetch?: typeof fetch; timeoutMs?: number };

const ATTRIBUTION = "Weather data by Open-Meteo.com";

/** Trimmed city name, or null if it is not 1-80 letters, spaces and - ' . , */
export function cleanCity(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const s = input.trim();
  return s.length >= 1 && s.length <= 80 && /^[\p{L} \-'.,]+$/u.test(s) ? s : null;
}

async function getJson(url: string, opts: UvOpts): Promise<any> {
  try {
    const res = await (opts.fetch ?? fetch)(url, { signal: AbortSignal.timeout(opts.timeoutMs ?? 4000) });
    if (!res.ok) throw new Error("http");
    return await res.json();
  } catch {
    throw new UvError("uv_unavailable");
  }
}

export async function getUv(city: string, opts: UvOpts = {}): Promise<Uv> {
  const name = cleanCity(city);
  if (!name) throw new UvError("city_not_found");
  const geo = await getJson(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`,
    opts,
  );
  const hit = geo?.results?.[0];
  if (!hit) throw new UvError("city_not_found");
  const { latitude: lat, longitude: lon } = hit;
  if (typeof lat !== "number" || typeof lon !== "number") throw new UvError("uv_unavailable");
  const fc = await getJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=uv_index_max&timezone=auto&forecast_days=1`,
    opts,
  );
  const uvMax = fc?.daily?.uv_index_max?.[0];
  const date = fc?.daily?.time?.[0];
  if (typeof uvMax !== "number" || typeof date !== "string") throw new UvError("uv_unavailable");
  return { city: String(hit.name ?? name), country: String(hit.country ?? ""), lat, lon, uvMax, date, source: "live", attribution: ATTRIBUTION };
}

/** WHO UV index bands. */
export function uvBand(uv: number): "low" | "moderate" | "high" | "very_high" | "extreme" {
  if (uv < 3) return "low";
  if (uv < 6) return "moderate";
  if (uv < 8) return "high";
  if (uv < 11) return "very_high";
  return "extreme";
}

/** The reading recorded by scripts/record-uv.ts: used when the live lookup fails. */
export function recordedUv(): Uv {
  return JSON.parse(readFileSync(path.join(process.cwd(), "fixtures", "demo", "uv.json"), "utf8"));
}

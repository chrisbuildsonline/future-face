import { describe, expect, test } from "bun:test";
import { cleanCity, getUv, UvError, uvBand } from "./uv";

function mockFetch(handler: (url: string) => Response) {
  const calls: string[] = [];
  const f = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    return handler(url);
  }) as typeof fetch;
  return { f, calls };
}

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });

describe("cleanCity", () => {
  test("accepts letters of any script, spaces and - ' . ,", () => {
    expect(cleanCity("São Paulo")).toBe("São Paulo");
    expect(cleanCity("  St. John's ")).toBe("St. John's");
    expect(cleanCity("東京")).toBe("東京");
  });
  test("rejects markup, empty, too long and non-strings", () => {
    expect(cleanCity("<script>")).toBeNull();
    expect(cleanCity("")).toBeNull();
    expect(cleanCity("   ")).toBeNull();
    expect(cleanCity("a".repeat(81))).toBeNull();
    expect(cleanCity("a".repeat(80))).not.toBeNull();
    expect(cleanCity(42)).toBeNull();
  });
});

describe("getUv", () => {
  test("geocodes then fetches the forecast", async () => {
    const { f, calls } = mockFetch((url) =>
      url.includes("geocoding-api")
        ? json({ results: [{ name: "Lisbon", country: "Portugal", latitude: 38.72, longitude: -9.14 }] })
        : json({ daily: { time: ["2026-10-30"], uv_index_max: [4.4] } }),
    );
    const uv = await getUv("Lisbon", { fetch: f });
    expect(uv).toEqual({
      city: "Lisbon",
      country: "Portugal",
      lat: 38.72,
      lon: -9.14,
      uvMax: 4.4,
      date: "2026-10-30",
      source: "live",
      attribution: "Weather data by Open-Meteo.com",
    });
    expect(calls[0]).toBe("https://geocoding-api.open-meteo.com/v1/search?name=Lisbon&count=1&language=en&format=json");
    expect(calls[1]).toBe(
      "https://api.open-meteo.com/v1/forecast?latitude=38.72&longitude=-9.14&daily=uv_index_max&timezone=auto&forecast_days=1",
    );
  });

  test("no geocode results -> city_not_found", async () => {
    const { f } = mockFetch(() => json({}));
    const err = await getUv("Nowhereville", { fetch: f }).catch((e) => e);
    expect(err).toBeInstanceOf(UvError);
    expect(err.kind).toBe("city_not_found");
  });

  test("HTTP 500 -> uv_unavailable", async () => {
    const { f } = mockFetch(() => json({}, 500));
    const err = await getUv("Lisbon", { fetch: f }).catch((e) => e);
    expect(err).toBeInstanceOf(UvError);
    expect(err.kind).toBe("uv_unavailable");
  });

  test("network failure and bad json -> uv_unavailable", async () => {
    const boom = (async () => {
      throw new Error("down");
    }) as unknown as typeof fetch;
    expect((await getUv("Lisbon", { fetch: boom }).catch((e) => e)).kind).toBe("uv_unavailable");
    const { f } = mockFetch(() => new Response("not json"));
    expect((await getUv("Lisbon", { fetch: f }).catch((e) => e)).kind).toBe("uv_unavailable");
  });

  test("forecast without a number -> uv_unavailable", async () => {
    const { f } = mockFetch((url) =>
      url.includes("geocoding-api")
        ? json({ results: [{ name: "Lisbon", country: "Portugal", latitude: 1, longitude: 2 }] })
        : json({ daily: {} }),
    );
    expect((await getUv("Lisbon", { fetch: f }).catch((e) => e)).kind).toBe("uv_unavailable");
  });

  test("invalid city never calls fetch", async () => {
    const { f, calls } = mockFetch(() => json({}));
    const err = await getUv("<b>", { fetch: f }).catch((e) => e);
    expect(err.kind).toBe("city_not_found");
    expect(calls).toHaveLength(0);
  });
});

describe("uvBand", () => {
  test("WHO band edges", () => {
    expect(uvBand(2.9)).toBe("low");
    expect(uvBand(3)).toBe("moderate");
    expect(uvBand(5.99)).toBe("moderate");
    expect(uvBand(6)).toBe("high");
    expect(uvBand(7.9)).toBe("high");
    expect(uvBand(8)).toBe("very_high");
    expect(uvBand(10.9)).toBe("very_high");
    expect(uvBand(11)).toBe("extreme");
  });
});

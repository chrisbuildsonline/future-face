import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import sharp from "sharp";
import { GET as demoImage } from "../app/api/demo-image/[name]/route";
import { GET, POST } from "../app/api/future/route";
import { errors } from "./copy";

const realFetch = globalThis.fetch;
const saved = { key: process.env.YOUCAM_SECRET_KEY, max: process.env.LIVE_RUNS_MAX };
let fetchCalls: string[] = [];

const geo = { results: [{ name: "Lisbon", country: "Portugal", latitude: 38.72, longitude: -9.14 }] };
const forecast = { daily: { time: ["2026-10-30"], uv_index_max: [4.4] } };

function mockOpenMeteo(geocode: unknown = geo) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    fetchCalls.push(url);
    return Response.json(url.includes("geocoding-api") ? geocode : forecast);
  }) as typeof fetch;
}

beforeEach(() => {
  delete process.env.YOUCAM_SECRET_KEY;
  delete process.env.LIVE_RUNS_MAX;
  fetchCalls = [];
  mockOpenMeteo();
});

afterEach(() => {
  globalThis.fetch = realFetch;
  if (saved.key === undefined) delete process.env.YOUCAM_SECRET_KEY;
  else process.env.YOUCAM_SECRET_KEY = saved.key;
  if (saved.max === undefined) delete process.env.LIVE_RUNS_MAX;
  else process.env.LIVE_RUNS_MAX = saved.max;
});

const jpg = () => sharp({ create: { width: 64, height: 64, channels: 3, background: "#999" } }).jpeg().toBuffer();

async function post(opts: { selfie?: Uint8Array | null; city?: string; size?: number }) {
  const form = new FormData();
  if (opts.selfie !== null) {
    const bytes = opts.size ? new Uint8Array(opts.size) : (opts.selfie ?? (await jpg()));
    form.append("selfie", new File([bytes as BlobPart], "me.jpg", { type: "image/jpeg" }));
  }
  if (opts.city !== undefined) form.append("city", opts.city);
  return POST(new Request("http://x/api/future", { method: "POST", body: form }));
}

describe("GET /api/future", () => {
  test("demo result with recorded uv", async () => {
    const res = await GET(new Request("http://x/api/future"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe("demo");
    expect(body.horizons).toHaveLength(2);
    expect(body.uv.source).toBe("recorded");
    expect(fetchCalls).toHaveLength(0);
  });

  test("?city= uses live uv, falls back to recorded on failure, 400 on bad city", async () => {
    const ok = await (await GET(new Request("http://x/api/future?city=Lisbon"))).json();
    expect(ok.uv.city).toBe("Lisbon");
    globalThis.fetch = (async () => new Response("no", { status: 500 })) as unknown as typeof fetch;
    const fb = await (await GET(new Request("http://x/api/future?city=Lisbon"))).json();
    expect(fb.uv.source).toBe("recorded");
    const bad = await GET(new Request("http://x/api/future?city=%3Cb%3E"));
    expect(bad.status).toBe(400);
  });
});

describe("POST /api/future", () => {
  test("no key -> demo result with the city's uv and a notice", async () => {
    const res = await post({ city: "Lisbon" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe("demo");
    expect(body.notice).toBe(errors.no_key);
    expect(body.uv.city).toBe("Lisbon");
  });

  test("missing selfie -> 400 bad_format", async () => {
    const res = await post({ selfie: null, city: "Lisbon" });
    expect(res.status).toBe(400);
    expect((await res.json()).error.kind).toBe("bad_format");
  });

  test("11 MB -> 413 file_too_large", async () => {
    const res = await post({ size: 11 * 1024 * 1024, city: "Lisbon" });
    expect(res.status).toBe(413);
    expect((await res.json()).error).toEqual({ kind: "file_too_large", message: errors.file_too_large });
  });

  test("huge content-length -> 413 before the body is parsed, no fetch", async () => {
    const form = new FormData();
    form.append("city", "Lisbon");
    const req = new Request("http://x/api/future", { method: "POST", body: form });
    const big = new Request(req, { headers: { "content-type": req.headers.get("content-type")!, "content-length": "20000000" } });
    const res = await POST(big);
    expect(res.status).toBe(413);
    expect((await res.json()).error.kind).toBe("file_too_large");
    expect(fetchCalls).toHaveLength(0);
  });

  test("invalid city -> 400 and no fetch", async () => {
    const res = await post({ city: "<b>" });
    expect(res.status).toBe(400);
    expect((await res.json()).error.kind).toBe("city_not_found");
    expect(fetchCalls).toHaveLength(0);
  });

  test("unknown city -> 400 city_not_found", async () => {
    mockOpenMeteo({});
    const res = await post({ city: "Nowhereville" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.kind).toBe("city_not_found");
    expect(body.error.message).toContain("couldn't find that city");
  });

  test("uv outage does not block the run", async () => {
    globalThis.fetch = (async () => new Response("no", { status: 500 })) as unknown as typeof fetch;
    const res = await post({ city: "Lisbon" });
    expect(res.status).toBe(200);
    expect((await res.json()).uv).toBeNull();
  });

  test("live cap -> 429 without calling YouCam", async () => {
    process.env.YOUCAM_SECRET_KEY = "test-key";
    process.env.LIVE_RUNS_MAX = "0";
    const res = await post({ city: "Lisbon" });
    expect(res.status).toBe(429);
    expect((await res.json()).error.kind).toBe("rate_limited");
    expect(fetchCalls.every((u) => u.includes("open-meteo.com"))).toBe(true);
  });
});

describe("GET /api/demo-image/[name]", () => {
  const get = (name: string) =>
    demoImage(new Request("http://x"), { params: Promise.resolve({ name }) });

  test("serves an allowlisted jpeg", async () => {
    const res = await get("now-10.jpg");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(1000);
  });

  test("404s anything else", async () => {
    for (const name of ["result.json", "../.env", "..%2F.env"]) {
      const res = await get(name);
      expect(res.status).toBe(404);
    }
  });
});

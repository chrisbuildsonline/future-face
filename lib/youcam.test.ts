import { beforeEach, describe, expect, test } from "bun:test";
import { deflateRawSync } from "node:zlib";
import sharp from "sharp";
import * as copy from "./copy";
import { findBannedWords } from "./banned";
import {
  analyzeSkin,
  ageFace,
  downloadFrame,
  simulateSkin,
  pickNearest,
  readZip,
  youcamBaseUrl,
  hasYoucamKey,
  YoucamError,
  ERROR_KINDS,
  CODE_TO_KIND,
} from "./youcam";
import { prepareForSimulation, prepareForAging, cropToCenter } from "./image";

const HOST = "https://yce-api-01.makeupar.com";
const fast = { intervalMs: 1, timeoutMs: 200 };

type Call = { url: string; method: string; headers: Record<string, string>; body?: unknown };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** Mock fetch driven by a handler; records every call. */
function mockFetch(handler: (c: Call, n: number) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = init?.body;
    const body =
      typeof raw === "string" ? JSON.parse(raw) : raw instanceof Uint8Array ? raw : undefined;
    const call: Call = {
      url: String(input),
      method: init?.method ?? "GET",
      headers: (init?.headers ?? {}) as Record<string, string>,
      body,
    };
    calls.push(call);
    return handler(call, calls.length);
  }) as typeof fetch;
  return { f, calls };
}

const UPLOAD = "https://s3.example.com/up/abc";
const registerReply = () =>
  json({
    status: 200,
    data: {
      files: [
        {
          file_id: "FILE1",
          requests: [{ method: "PUT", url: UPLOAD, headers: { "Content-Type": "image/jpg", "Content-Length": "5" } }],
        },
      ],
    },
  });

async function jpg(w: number, h: number) {
  return sharp({ create: { width: w, height: h, channels: 3, background: "#c88" } }).jpeg().toBuffer();
}

/** Build a zip with deflated entries (plus one stored) for the reader test. */
function buildZip(entries: Record<string, Buffer>, stored?: Record<string, Buffer>) {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  const all: [string, Buffer, number][] = [
    ...Object.entries(entries).map(([n, d]) => [n, d, 8] as [string, Buffer, number]),
    ...Object.entries(stored ?? {}).map(([n, d]) => [n, d, 0] as [string, Buffer, number]),
  ];
  for (const [name, data, method] of all) {
    const comp = method === 8 ? deflateRawSync(data) : data;
    const nm = Buffer.from(name);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(method, 8);
    lh.writeUInt32LE(comp.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nm.length, 26);
    locals.push(lh, nm, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(method, 10);
    ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nm.length, 28);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, nm);
    offset += 30 + nm.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(all.length, 8);
  end.writeUInt16LE(all.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

beforeEach(() => {
  process.env.YOUCAM_SECRET_KEY = "test-key";
  delete process.env.YOUCAM_API_URL;
  delete process.env.YOUCAM_API_KEY;
});

describe("env", () => {
  test("base url: default when missing or invalid, custom when http(s)", () => {
    expect(youcamBaseUrl()).toBe(HOST);
    for (const bad of ["set by orchestrator", "", "ftp://x", "https://"]) {
      process.env.YOUCAM_API_URL = bad;
      expect(youcamBaseUrl()).toBe(HOST);
    }
    process.env.YOUCAM_API_URL = "https://example.test/";
    expect(youcamBaseUrl()).toBe("https://example.test");
    process.env.YOUCAM_API_URL = "http://localhost:9000";
    expect(youcamBaseUrl()).toBe("http://localhost:9000");
  });

  test("YOUCAM_API_KEY works as another name; YOUCAM_SECRET_KEY wins when both are set", async () => {
    const auth = async () => {
      const { f, calls } = mockFetch(() => json({}));
      await analyzeSkin(await jpg(600, 800), { fetch: f, ...fast }).catch(() => {});
      return calls[0]?.headers.Authorization;
    };
    process.env.YOUCAM_SECRET_KEY = "";
    process.env.YOUCAM_API_KEY = "alt-key";
    expect(hasYoucamKey()).toBe(true);
    expect(await auth()).toBe("Bearer alt-key");
    process.env.YOUCAM_SECRET_KEY = "test-key";
    expect(await auth()).toBe("Bearer test-key");
  });

  test("hasYoucamKey and no_key error", async () => {
    expect(hasYoucamKey()).toBe(true);
    delete process.env.YOUCAM_SECRET_KEY;
    expect(hasYoucamKey()).toBe(false);
    const { f, calls } = mockFetch(() => json({}));
    const err = await analyzeSkin(await jpg(600, 800), { fetch: f, ...fast }).catch((e) => e);
    expect(err).toBeInstanceOf(YoucamError);
    expect(err.kind).toBe("no_key");
    expect(err.code).toBe("no_key");
    expect(calls.length).toBe(0);
  });
});

describe("skin analysis", () => {
  test("happy path: register, upload, task, poll, parse zip", async () => {
    const scoreInfo = {
      wrinkle: { raw_score: 36.1, ui_score: 60, output_mask_name: "wrinkle_output.png" },
      pore: { raw_score: 88.4, ui_score: 84, output_mask_name: "pore_output.png" },
      all: { score: 75.7 },
      skin_age: 37,
    };
    const zip = buildZip({ "skinanalysisResult/score_info.json": Buffer.from(JSON.stringify(scoreInfo)) });
    let polls = 0;
    const { f, calls } = mockFetch((c) => {
      if (c.url === `${HOST}/s2s/v2.0/file`) return registerReply();
      if (c.url === UPLOAD) return new Response(null, { status: 200 });
      if (c.url === `${HOST}/s2s/v2.0/task/skin-analysis`) return json({ status: 200, data: { task_id: "T1" } });
      if (c.url === `${HOST}/s2s/v2.0/task/skin-analysis/T1`) {
        polls++;
        return polls < 2
          ? json({ status: 200, data: { task_status: "running" } })
          : json({ status: 200, data: { task_status: "success", results: { url: "https://dl.example.com/r.zip" } } });
      }
      if (c.url === "https://dl.example.com/r.zip") return new Response(new Uint8Array(zip));
      throw new Error("unexpected " + c.url);
    });
    const res = await analyzeSkin(await jpg(600, 800), { fetch: f, ...fast });

    expect(res.skinAge).toBe(37);
    expect(res.overall).toBe(75.7);
    expect(res.concerns.wrinkle).toEqual({ raw_score: 36.1, ui_score: 60 });
    expect(res.concerns.pore).toEqual({ raw_score: 88.4, ui_score: 84 });
    expect(res.concerns.all).toBeUndefined();

    expect(calls[0].method).toBe("POST");
    expect(calls[0].headers.Authorization).toBe("Bearer test-key");
    const reg = (calls[0].body as any).files[0];
    expect(reg.content_type).toBe("image/jpg");
    expect(typeof reg.file_size).toBe("number");
    expect(calls[1].url).toBe(UPLOAD);
    expect(calls[1].method).toBe("PUT");
    expect(calls[1].headers.Authorization).toBeUndefined();
    expect(calls[1].headers["Content-Type"]).toBe("image/jpg");
    expect(calls[2].url).toBe(`${HOST}/s2s/v2.0/task/skin-analysis`);
    expect(calls[2].method).toBe("POST");
    expect(calls[2].headers.Authorization).toBe("Bearer test-key");
    const body = calls[2].body as any;
    expect(body.src_file_id).toBe("FILE1");
    expect(body.format).toBe("zip");
    expect(body.dst_actions.length).toBeGreaterThan(5);
    expect(body.dst_actions.some((a: string) => a.startsWith("hd_"))).toBe(false);
    expect(calls[3].method).toBe("GET");
    expect(calls[3].url).toBe(`${HOST}/s2s/v2.0/task/skin-analysis/T1`);
    expect(polls).toBe(2);
  });

  test("actions option sets dst_actions; unknown actions are rejected before any call", async () => {
    const zip = buildZip({ "skinanalysisResult/score_info.json": Buffer.from(JSON.stringify({ skin_age: 41 })) });
    const { f, calls } = mockFetch((c) => {
      if (c.url.endsWith("/file")) return registerReply();
      if (c.url === UPLOAD) return new Response(null);
      if (c.method === "POST") return json({ status: 200, data: { task_id: "T" } });
      if (c.url.endsWith("/T"))
        return json({ status: 200, data: { task_status: "success", results: "https://dl.example.com/z" } });
      return new Response(new Uint8Array(zip));
    });
    const img = await jpg(600, 800);
    await analyzeSkin(img, { fetch: f, ...fast, actions: ["wrinkle", "age_spot", "texture"] });
    expect((calls[2].body as any).dst_actions).toEqual(["wrinkle", "age_spot", "texture"]);

    const before = calls.length;
    for (const bad of [["bogus"], ["wrinkle", "hd_wrinkle"]]) {
      const err = await analyzeSkin(img, { fetch: f, ...fast, actions: bad }).catch((e) => e);
      expect(err).toBeInstanceOf(YoucamError);
      expect(err.code).toBe("invalid_settings");
      expect(err.kind).toBe("unknown");
    }
    expect(calls.length).toBe(before);
  });

  test("zip result given directly as a string url also works", async () => {
    const zip = buildZip({ "skinanalysisResult/score_info.json": Buffer.from(JSON.stringify({ skin_age: 41 })) });
    const { f } = mockFetch((c) => {
      if (c.url.endsWith("/file")) return registerReply();
      if (c.url === UPLOAD) return new Response(null);
      if (c.method === "POST") return json({ status: 200, data: { task_id: "T" } });
      if (c.url.endsWith("/T"))
        return json({ status: 200, data: { task_status: "success", results: "https://dl.example.com/z" } });
      return new Response(new Uint8Array(zip));
    });
    const res = await analyzeSkin(await jpg(600, 800), { fetch: f, ...fast });
    expect(res.skinAge).toBe(41);
  });
});

describe("aging", () => {
  test("happy path returns all frames and input age", async () => {
    const { f, calls } = mockFetch((c) => {
      if (c.url.endsWith("/s2s/v2.0/file")) return registerReply();
      if (c.url === UPLOAD) return new Response(null);
      if (c.url === `${HOST}/s2s/v2.0/task/aging`) return json({ status: 200, data: { task_id: "A1" } });
      if (c.url === `${HOST}/s2s/v2.0/task/aging/A1`)
        return json({
          status: 200,
          data: {
            task_status: "success",
            results: {
              age: 30,
              output: [
                { res_age: 20, url: "https://dl/a" },
                { res_age: 45, url: "https://dl/b" },
              ],
            },
          },
        });
      throw new Error("unexpected " + c.url);
    });
    const res = await ageFace(await jpg(600, 800), { fetch: f, ...fast });
    expect(res.inputAge).toBe(30);
    expect(res.frames).toEqual([
      { resAge: 20, url: "https://dl/a" },
      { resAge: 45, url: "https://dl/b" },
    ]);
    expect((calls[2].body as any)).toEqual({ src_file_id: "FILE1" });
    expect(calls[2].headers.Authorization).toBe("Bearer test-key");
  });

  test("downloadFrame returns bytes", async () => {
    const { f } = mockFetch(() => new Response(new Uint8Array([1, 2, 3])));
    const b = await downloadFrame("https://dl/a", { fetch: f });
    expect([...b]).toEqual([1, 2, 3]);
  });

  test("pickNearest", () => {
    const frames = [
      { resAge: 20, url: "a" },
      { resAge: 40, url: "b" },
      { resAge: 70, url: "c" },
    ];
    expect(pickNearest(frames, 30, 15)?.resAge).toBe(40);
    expect(pickNearest(frames, 30, 40)?.resAge).toBe(70);
    expect(pickNearest(frames, 30, 100)?.resAge).toBe(70);
    expect(pickNearest(frames, 30, -50)?.resAge).toBe(20);
    expect(pickNearest([], 30, 10)).toBeUndefined();
  });
});

describe("skin simulation", () => {
  test("happy path downloads bytes immediately", async () => {
    const out = new Uint8Array([9, 8, 7, 6]);
    const { f, calls } = mockFetch((c) => {
      if (c.url.endsWith("/s2s/v2.0/file")) return registerReply();
      if (c.url === UPLOAD) return new Response(null);
      if (c.url === `${HOST}/s2s/v2.0/task/skin-simulation`) return json({ status: 200, data: { task_id: "S1" } });
      if (c.url === `${HOST}/s2s/v2.0/task/skin-simulation/S1`)
        return json({ status: 200, data: { task_status: "success", results: { url: "https://dl/sim.jpg" } } });
      if (c.url === "https://dl/sim.jpg") return new Response(out);
      throw new Error("unexpected " + c.url);
    });
    const res = await simulateSkin(await jpg(600, 800), { wrinkle: 1, redness: 0.5 }, { fetch: f, ...fast });
    expect([...res]).toEqual([9, 8, 7, 6]);
    const body = calls[2].body as any;
    expect(body).toEqual({ src_file_id: "FILE1", wrinkle: 1, redness: 0.5 });
    expect(calls[2].headers.Authorization).toBe("Bearer test-key");
    expect(calls[calls.length - 1].url).toBe("https://dl/sim.jpg");
  });

  test("validates settings before any call", async () => {
    const { f, calls } = mockFetch(() => json({}));
    const img = await jpg(600, 800);
    for (const bad of [{}, { wrinkle: 0 }, { wrinkle: 1.2 }, { acne: -0.1 }, { bogus: 1 }, { acne: NaN }]) {
      const err = await simulateSkin(img, bad as any, { fetch: f, ...fast }).catch((e) => e);
      expect(err).toBeInstanceOf(YoucamError);
      expect(err.kind).toBe("unknown");
      expect(err.code).toBe("invalid_settings");
    }
    expect(calls.length).toBe(0);
  });
});

describe("errors", () => {
  test("poll timeout -> timeout kind", async () => {
    const { f } = mockFetch((c) => {
      if (c.url.endsWith("/s2s/v2.0/file")) return registerReply();
      if (c.url === UPLOAD) return new Response(null);
      if (c.method === "POST") return json({ status: 200, data: { task_id: "T" } });
      return json({ status: 200, data: { task_status: "running" } });
    });
    const err = await ageFace(await jpg(600, 800), { fetch: f, intervalMs: 1, timeoutMs: 20 }).catch((e) => e);
    expect(err).toBeInstanceOf(YoucamError);
    expect(err.kind).toBe("timeout");
    expect(err.code).toBe("timeout");
  });

  function failingPoll(errorCode: string) {
    return mockFetch((c) => {
      if (c.url.endsWith("/s2s/v2.0/file")) return registerReply();
      if (c.url === UPLOAD) return new Response(null);
      if (c.method === "POST") return json({ status: 200, data: { task_id: "T" } });
      return json({
        status: 200,
        data: { task_status: "error", error: errorCode, error_message: "secret raw text Bearer test-key" },
      });
    });
  }

  test("every documented code maps to its kind, via poll error", async () => {
    const img = await jpg(600, 800);
    for (const [code, kind] of Object.entries(CODE_TO_KIND)) {
      const { f } = failingPoll(code);
      const err = await ageFace(img, { fetch: f, ...fast }).catch((e) => e);
      expect(err).toBeInstanceOf(YoucamError);
      expect(err.code).toBe(code);
      expect(err.kind).toBe(kind);
      expect(ERROR_KINDS).toContain(kind);
      expect(err.message).toBe(kind);
    }
  });

  test("spot checks of documented codes", () => {
    expect(CODE_TO_KIND.error_no_face).toBe("no_face");
    expect(CODE_TO_KIND.error_src_face_too_small).toBe("face_too_small");
    expect(CODE_TO_KIND.error_face_angle_upward).toBe("bad_pose");
    expect(CODE_TO_KIND.error_below_min_image_size).toBe("bad_image_size");
    expect(CODE_TO_KIND.exceed_max_filesize).toBe("file_too_large");
    expect(CODE_TO_KIND.error_lighting_dark).toBe("low_quality");
    expect(CODE_TO_KIND.CreditInsufficiency).toBe("insufficient_units");
  });

  test("unknown poll code -> unknown, no raw text in message", async () => {
    const { f } = failingPoll("some_new_code");
    const err = await ageFace(await jpg(600, 800), { fetch: f, ...fast }).catch((e) => e);
    expect(err.kind).toBe("unknown");
    expect(err.code).toBe("some_new_code");
    expect(err.message).toBe("unknown");
    expect(JSON.stringify(err.message)).not.toContain("secret");
  });

  test("http errors on request: 400 error_code, 401 auth, 429 rate_limited, 500 server_busy, 418 unknown", async () => {
    const img = await jpg(600, 800);
    const cases: [number, unknown, string, string][] = [
      [400, { status: 400, error: "x", error_code: "CreditInsufficiency" }, "CreditInsufficiency", "insufficient_units"],
      [401, { status: 401, error: "Invalid API key" }, "http_401", "auth"],
      [429, { status: 429, error: "Too many requests" }, "http_429", "rate_limited"],
      [500, { status: 500, error: "Task execution timed out" }, "http_500", "server_busy"],
      [418, "not json", "http_418", "unknown"],
    ];
    for (const [status, body, code, kind] of cases) {
      const { f } = mockFetch(() =>
        typeof body === "string" ? new Response(body, { status }) : json(body, status),
      );
      const err = await ageFace(img, { fetch: f, ...fast }).catch((e) => e);
      expect(err).toBeInstanceOf(YoucamError);
      expect(err.code).toBe(code);
      expect(err.kind).toBe(kind);
    }
  });

  test("network failure -> unknown without raw text", async () => {
    const f = (async () => {
      throw new Error("ECONNRESET secret-host");
    }) as unknown as typeof fetch;
    const err = await ageFace(await jpg(600, 800), { fetch: f, ...fast }).catch((e) => e);
    expect(err).toBeInstanceOf(YoucamError);
    expect(err.kind).toBe("unknown");
    expect(err.message).not.toContain("ECONNRESET");
  });

  test("failed upload PUT -> http_<status>", async () => {
    const { f } = mockFetch((c) => (c.url === UPLOAD ? new Response("no", { status: 403 }) : registerReply()));
    const err = await ageFace(await jpg(600, 800), { fetch: f, ...fast }).catch((e) => e);
    expect(err.code).toBe("http_403");
    expect(err.kind).toBe("auth");
  });

  test("ERROR_KINDS covers the required set", () => {
    for (const k of [
      "no_face", "multiple_faces", "face_too_small", "bad_pose", "bad_image_size", "bad_format",
      "file_too_large", "low_quality", "insufficient_units", "rate_limited", "auth", "server_busy",
      "timeout", "no_key", "unknown",
    ]) expect(ERROR_KINDS as readonly string[]).toContain(k);
  });
});

describe("readZip", () => {
  test("reads deflated and stored entries", () => {
    const a = Buffer.from("hello ".repeat(100));
    const b = Buffer.from("stored");
    const zip = buildZip({ "dir/a.txt": a }, { "b.txt": b });
    const files = readZip(zip);
    expect(files["dir/a.txt"].equals(a)).toBe(true);
    expect(files["b.txt"].equals(b)).toBe(true);
  });

  test("rejects non-zip", () => {
    expect(() => readZip(Buffer.from("nope"))).toThrow(YoucamError);
  });
});

describe("image helpers", () => {
  test("prepareForSimulation upscales small image to short side >= 480", async () => {
    const png = await sharp({ create: { width: 300, height: 400, channels: 3, background: "#888" } }).png().toBuffer();
    const out = await prepareForSimulation(png);
    const m = await sharp(out).metadata();
    expect(m.format).toBe("jpeg");
    expect(Math.min(m.width!, m.height!)).toBeGreaterThanOrEqual(480);
    expect(Math.max(m.width!, m.height!)).toBeLessThanOrEqual(2560);
    expect(out.length).toBeLessThan(10 * 1024 * 1024);
  });

  test("prepareForSimulation downsizes big image to long side <= 2560", async () => {
    const big = await sharp({ create: { width: 3000, height: 5000, channels: 3, background: "#888" } }).png().toBuffer();
    const m = await sharp(await prepareForSimulation(big)).metadata();
    expect(m.format).toBe("jpeg");
    expect(Math.max(m.width!, m.height!)).toBeLessThanOrEqual(2560);
    expect(Math.min(m.width!, m.height!)).toBeGreaterThanOrEqual(480);
  });

  test("prepareForAging gives jpeg with long side in 320..4096", async () => {
    const big = await sharp({ create: { width: 5000, height: 4000, channels: 3, background: "#888" } }).png().toBuffer();
    const m = await sharp(await prepareForAging(big)).metadata();
    expect(m.format).toBe("jpeg");
    expect(Math.max(m.width!, m.height!)).toBeLessThanOrEqual(4096);
    const small = await sharp({ create: { width: 100, height: 150, channels: 3, background: "#888" } }).png().toBuffer();
    const m2 = await sharp(await prepareForAging(small)).metadata();
    expect(m2.format).toBe("jpeg");
    expect(Math.min(m2.width!, m2.height!)).toBeGreaterThanOrEqual(320);
  });

  test("cropToCenter crops the middle by fraction", async () => {
    const img = await sharp({ create: { width: 400, height: 500, channels: 3, background: "#888" } }).png().toBuffer();
    const m = await sharp(await cropToCenter(img, 0.5)).metadata();
    expect(m.width).toBe(200);
    expect(m.height).toBe(250);
    const full = await sharp(await cropToCenter(img, 1)).metadata();
    expect(full.width).toBe(400);
  });
});

describe("error wording coverage", () => {
  test("copy.errors has a clean, non-empty string for every kind", () => {
    const errors = (copy as any).errors;
    for (const kind of ERROR_KINDS) {
      expect(typeof errors?.[kind]).toBe("string");
      expect(errors[kind].trim().length).toBeGreaterThan(0);
    }
    expect(findBannedWords(errors)).toEqual([]);
  });
});

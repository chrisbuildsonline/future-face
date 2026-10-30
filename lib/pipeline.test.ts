import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import { demoImagePath, loadDemo } from "./fixtures";
import { CROP_LADDER, demoResult, measuredLine, runLive } from "./pipeline";
import { YoucamError, type SkinAnalysis } from "./youcam";

const an = (c: Record<string, number>, skinAge?: number): SkinAnalysis => ({
  concerns: Object.fromEntries(Object.entries(c).map(([k, v]) => [k, { raw_score: v }])),
  ...(skinAge ? { skinAge } : {}),
});

describe("measuredLine", () => {
  test("recorded +30 numbers", () => {
    const d = loadDemo().horizons[1];
    const line = measuredLine(d.now.analysis, d.spf.analysis);
    expect(line.map((l) => l.key)).toEqual(["spots", "wrinkle", "texture"]);
    const w = line.find((l) => l.key === "wrinkle")!;
    const r1 = (n: number) => Math.round(n * 10) / 10;
    expect(w.analysisKey).toBe("wrinkle");
    expect(w.now).toBe(r1(d.now.analysis.concerns.wrinkle.raw_score));
    expect(w.spf).toBe(r1(d.spf.analysis.concerns.wrinkle.raw_score));
    expect(w.delta).toBe(r1(w.spf - w.now));
  });
  test("skips a concern missing from either side", () => {
    const line = measuredLine(an({ wrinkle: 70, texture: 80 }), an({ wrinkle: 75, age_spot: 90 }));
    expect(line.map((l) => l.key)).toEqual(["wrinkle"]);
    expect(line[0].delta).toBe(5);
  });
});

describe("demoResult", () => {
  test("two horizons with servable image urls", () => {
    const r = demoResult();
    expect(r.source).toBe("demo");
    expect(r.horizons).toHaveLength(2);
    expect(r.input).toBe("/api/demo-image/input.jpg");
    expect(r.uv?.source).toBe("recorded");
    for (const h of r.horizons) {
      for (const url of [h.now.image, h.spf.image]) {
        expect(url.startsWith("/api/demo-image/")).toBe(true);
        expect(() => demoImagePath(url.slice("/api/demo-image/".length))).not.toThrow();
      }
      expect(typeof h.spfResAge).toBe("number");
      if (h.sameFrame) expect(h.measured).toEqual([]);
      else {
        expect(h.spfResAge).toBeLessThan(h.resAge);
        expect(h.measured.length).toBeGreaterThan(0);
      }
    }
    expect(r.horizons.map((h) => h.years)).toEqual([20, 30]);
  });
  test("uses a caller-supplied uv", () => {
    expect(demoResult(null).uv).toBeNull();
  });
});

describe("runLive", () => {
  // input 30: +20 -> now 50 / spf nearest 45.2 = 45; +30 -> now 60 / spf nearest 52.8 = 55
  const frames = [30, 35, 40, 45, 50, 55, 60].map((resAge) => ({ resAge, url: `u${resAge}` }));
  const mk = async (w = 1020, h = 1020) =>
    sharp({ create: { width: w, height: h, channels: 3, background: "#888" } }).jpeg().toBuffer();
  const png = () => sharp({ create: { width: 600, height: 600, channels: 3, background: "#777" } }).png().toBuffer();

  function deps(over: Record<string, unknown> = {}) {
    const log = { sim: 0, downloads: [] as string[], simWidths: [] as number[] };
    const d = {
      ageFace: async () => ({ inputAge: 30, frames }),
      downloadFrame: async (url: string) => {
        log.downloads.push(url);
        return mk();
      },
      simulateSkin: async (bytes: Uint8Array) => {
        log.sim++;
        log.simWidths.push((await sharp(bytes).metadata()).width!);
        return png();
      },
      analyzeSkin: async (_b: Uint8Array) => an({ wrinkle: 70, age_spot: 80, texture: 90 }, 40),
      ...over,
    };
    return { d: d as any, log };
  }

  test("picks nearest frames, returns jpeg data urls and a measured line", async () => {
    const { d, log } = deps();
    const r = await runLive(await mk(800, 800), d);
    expect(r.source).toBe("live");
    expect(r.inputAge).toBe(30);
    expect(r.frames).toEqual([30, 35, 40, 45, 50, 55, 60]);
    expect(log.downloads.sort()).toEqual(["u45", "u50", "u55", "u60"]);
    expect(r.horizons.map((h) => [h.years, h.targetAge, h.resAge, h.spfResAge, h.sameFrame])).toEqual([
      [20, 50, 50, 45, undefined],
      [30, 60, 60, 55, undefined],
    ]);
    for (const h of r.horizons) {
      expect(h.spf.image.startsWith("data:image/jpeg;base64,")).toBe(true);
      const bytes = Buffer.from(h.spf.image.split(",")[1], "base64");
      expect(bytes[0]).toBe(0xff);
      expect(bytes[1]).toBe(0xd8);
      expect(h.now.image.startsWith("data:image/jpeg;base64,")).toBe(true);
      expect(h.measured.map((m) => m.key)).toEqual(["spots", "wrinkle", "texture"]);
      expect(h.now.skinAge).toBe(40);
    }
    expect(r.input?.startsWith("data:image/jpeg;base64,")).toBe(true);
  });

  test("the SPF arm is a different, younger frame and simulation runs on it", async () => {
    const sizes: Record<string, number> = { u45: 900, u50: 1000, u55: 1100, u60: 1200 }; // distinct size per frame
    const simulated: string[] = [];
    const { d, log } = deps({
      downloadFrame: async (url: string) => {
        log.downloads.push(url);
        return mk(sizes[url], sizes[url]);
      },
      simulateSkin: async (bytes: Uint8Array) => {
        const w = (await sharp(bytes).metadata()).width!;
        simulated.push(Object.keys(sizes).find((u) => sizes[u] === w)!);
        return png();
      },
    });
    const r = await runLive(await mk(800, 800), d);
    expect(log.downloads.sort()).toEqual(["u45", "u50", "u55", "u60"]);
    expect(simulated.sort()).toEqual(["u45", "u55"]); // only the SPF frames, never the now frames
    expect(r.horizons.every((h) => h.spfResAge < h.resAge)).toBe(true);
  });

  test("same frame for both arms: sameFrame true, measured [], simulation still runs", async () => {
    const two = [30, 50].map((resAge) => ({ resAge, url: `u${resAge}` }));
    const { d, log } = deps({ ageFace: async () => ({ inputAge: 30, frames: two }) });
    const r = await runLive(await mk(800, 800), d);
    for (const h of r.horizons) {
      expect(h.sameFrame).toBe(true);
      expect(h.measured).toEqual([]);
      expect(h.resAge).toBe(50);
      expect(h.spfResAge).toBe(50);
    }
    expect(log.sim).toBe(2);
  });

  const settle = () => new Promise((r) => setTimeout(r, 100));
  const tooSmall = () => new YoucamError("error_src_face_too_small", "face_too_small");
  // 1 frame for both horizons is not possible, so widths are collected across both parallel ladders.
  const failing = (fails: (w: number) => boolean) => {
    const widths: number[] = [];
    return {
      widths,
      simulateSkin: async (bytes: Uint8Array) => {
        const w = (await sharp(bytes).metadata()).width!;
        widths.push(w);
        if (fails(w)) throw tooSmall();
        return png();
      },
    };
  };
  const w75 = Math.round(1020 * 0.75);
  const w55 = Math.max(480, Math.round(1020 * 0.55)); // prepareForSimulation upscales to a 480 floor

  test("face_too_small climbs the crop ladder 0.75 then 0.55", async () => {
    const f = failing((w) => w > w55);
    const { d } = deps({ simulateSkin: f.simulateSkin });
    const r = await runLive(await mk(), d);
    expect(r.horizons).toHaveLength(2);
    expect(CROP_LADDER).toEqual([0.75, 0.55]);
    expect(f.widths.filter((w) => w === 1020)).toHaveLength(2);
    expect(f.widths.filter((w) => w === w75)).toHaveLength(2);
    expect(f.widths.filter((w) => w === w55)).toHaveLength(2);
    expect(f.widths).toHaveLength(6);
  });

  test("stops after the first success", async () => {
    const f = failing((w) => w === 1020);
    const { d } = deps({ simulateSkin: f.simulateSkin });
    await runLive(await mk(), d);
    expect(f.widths).toHaveLength(4); // 2 horizons x (full + 0.75)
    expect(f.widths.filter((w) => w === w75)).toHaveLength(2);
  });

  test("a third face_too_small surfaces as face_too_small after exactly 3 simulate calls", async () => {
    const f = failing(() => true);
    const { d } = deps({ simulateSkin: f.simulateSkin });
    const err = await runLive(await mk(), d).catch((e) => e);
    expect(err).toBeInstanceOf(YoucamError);
    expect(err.kind).toBe("face_too_small");
    await settle(); // Promise.all rejects early; let the other horizon's ladder finish
    expect(f.widths.sort((a, b) => b - a)).toEqual([1020, 1020, w75, w75, w55, w55]); // both horizons: 3 calls each
  });

  test("non-face_too_small errors are not retried", async () => {
    let calls = 0;
    const { d } = deps({
      simulateSkin: async () => {
        calls++;
        throw new YoucamError("http_500", "unknown");
      },
    });
    const err = await runLive(await mk(), d).catch((e) => e);
    expect(err.kind).toBe("unknown");
    await settle();
    expect(calls).toBe(2); // one per horizon, no retries
  });

  test("ageFace face_too_small climbs the same ladder on the input selfie", async () => {
    const seen: number[] = [];
    const { d } = deps({
      ageFace: async (bytes: Uint8Array) => {
        const w = (await sharp(bytes).metadata()).width!;
        seen.push(w);
        if (seen.length < 3) throw tooSmall();
        return { inputAge: 30, frames };
      },
    });
    await runLive(await mk(1600, 1600), d);
    expect(seen).toEqual([1600, Math.round(1600 * 0.75), Math.round(1600 * 0.55)]);
  });

  test("ageFace: ladder exhausted throws face_too_small, other errors at once", async () => {
    let n = 0;
    const { d } = deps({
      ageFace: async () => {
        n++;
        throw tooSmall();
      },
    });
    const err = await runLive(await mk(1600, 1600), d).catch((e) => e);
    expect(err.kind).toBe("face_too_small");
    expect(n).toBe(3);
    n = 0;
    const { d: d2 } = deps({
      ageFace: async () => {
        n++;
        throw new YoucamError("http_500", "unknown");
      },
    });
    await runLive(await mk(1600, 1600), d2).catch(() => {});
    expect(n).toBe(1);
  });

  test("undecodable upload -> bad_format and ageFace is never called", async () => {
    let aged = 0;
    const { d } = deps({
      ageFace: async () => {
        aged++;
        return { inputAge: 30, frames };
      },
    });
    const err = await runLive(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), d).catch((e) => e);
    expect(err).toBeInstanceOf(YoucamError);
    expect(err.kind).toBe("bad_format");
    expect(aged).toBe(0);
  });

  test("no frame for a horizon throws YoucamError", async () => {
    const { d } = deps({ ageFace: async () => ({ inputAge: 30, frames: [] }) });
    const err = await runLive(await mk(), d).catch((e) => e);
    expect(err).toBeInstanceOf(YoucamError);
    expect(err.code).toBe("no_frame");
    expect(err.kind).toBe("unknown");
  });

  test("no input age throws YoucamError no_face", async () => {
    const { d } = deps({ ageFace: async () => ({ frames }) });
    const err = await runLive(await mk(), d).catch((e) => e);
    expect(err).toBeInstanceOf(YoucamError);
    expect(err.code).toBe("no_input_age");
    expect(err.kind).toBe("no_face");
  });
});

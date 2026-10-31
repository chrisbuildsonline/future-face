import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { DOSE_STEPS } from "./evidence";
import { DEMO_FACES, demoImagePath, isFace, loadDemo } from "./fixtures";

describe("recorded demo fixtures", () => {
  test("shape", () => {
    const d = loadDemo();
    expect(typeof d.recordedAt).toBe("string");
    expect(typeof d.inputAge).toBe("number");
    expect(d.frames.length).toBeGreaterThan(0);
    expect(d.horizons.map((h) => h.years)).toEqual([20, 30]);
    for (const h of d.horizons) {
      expect(typeof h.resAge).toBe("number");
      expect(d.frames).toContain(h.resAge);
      expect(h.spf.map((e) => e.intensity)).toEqual(DOSE_STEPS);
      for (const arm of [h.now, ...h.spf]) {
        for (const k of ["wrinkle", "age_spot", "texture"]) {
          expect(typeof arm.analysis.concerns[k].raw_score).toBe("number");
        }
      }
    }
  });

  test("every referenced image exists and is a JPEG", () => {
    const d = loadDemo();
    const names = ["input.jpg", ...d.horizons.flatMap((h) => [h.now.image, ...h.spf.map((e) => e.image)])];
    expect(names).toHaveLength(1 + 2 * 6);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) {
      const b = readFileSync(demoImagePath(n));
      expect([b[0], b[1], b[2]]).toEqual([0xff, 0xd8, 0xff]);
    }
  });

  test("demoImagePath rejects names not in result.json", () => {
    for (const bad of ["../.env", "../../.env", "/etc/passwd", "aged-30-now-raw.jpg", "result.json", ""]) {
      expect(() => demoImagePath(bad)).toThrow();
    }
  });
});

describe("second demo face", () => {
  test("faces and guard", () => {
    expect([...DEMO_FACES]).toEqual(["a", "b"]);
    expect(isFace("b")).toBe(true);
    for (const bad of ["zzz", "", "A", null, undefined, 1]) expect(isFace(bad)).toBe(false);
  });

  test("loadDemo(b) ships only the fully recorded +20 horizon, and differs from a", () => {
    const a = loadDemo();
    const b = loadDemo("b");
    expect(b.horizons.map((h) => h.years)).toEqual([20]);
    expect(b.horizons[0].spf.map((e) => e.intensity)).toEqual(DOSE_STEPS);
    expect(b.inputAge).toBe(38);
    expect(b.source).not.toBe(a.source);
    for (const h of b.horizons) {
      for (const name of [h.now.image, ...h.spf.map((e) => e.image)]) expect(existsSync(demoImagePath(name, "b"))).toBe(true);
    }
    expect(readFileSync(demoImagePath("input.jpg", "b")).equals(readFileSync(demoImagePath("input.jpg")))).toBe(false);
    expect(loadDemo().horizons.map((h) => h.years)).toEqual([20, 30]);
  });

  test("demoImagePath allowlist is per face and has no +30 for b", () => {
    for (const ok of ["now-20.jpg", "spf-20-024.jpg", "input.jpg"]) expect(() => demoImagePath(ok, "b")).not.toThrow();
    const bad = ["../.env", "../demo/input.jpg", "aged-20-now-raw.jpg", "aged-30-now-raw.jpg", "result.json", "partial.json", "now-30.jpg", ""];
    const spf30 = DOSE_STEPS.map((i) => `spf-30-${String(Math.round(i * 100)).padStart(3, "0")}.jpg`);
    for (const name of [...bad, ...spf30]) expect(() => demoImagePath(name, "b")).toThrow();
    expect(() => demoImagePath("now-30.jpg")).not.toThrow(); // face a unchanged
    expect(() => demoImagePath("now-20.jpg", "zzz" as never)).toThrow();
  });
});

describe("zero key", () => {
  const key = process.env.YOUCAM_SECRET_KEY;
  const realFetch = globalThis.fetch;
  afterEach(() => {
    if (key === undefined) delete process.env.YOUCAM_SECRET_KEY;
    else process.env.YOUCAM_SECRET_KEY = key;
    globalThis.fetch = realFetch;
  });

  test("loadDemo works with no key and never calls fetch", () => {
    delete process.env.YOUCAM_SECRET_KEY;
    let calls = 0;
    globalThis.fetch = (() => {
      calls++;
      throw new Error("fetch must not be called");
    }) as unknown as typeof fetch;
    expect(loadDemo().horizons.length).toBe(2);
    expect(calls).toBe(0);
  });
});

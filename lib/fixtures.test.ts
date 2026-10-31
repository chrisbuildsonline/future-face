import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { DOSE_STEPS } from "./evidence";
import { demoImagePath, loadDemo } from "./fixtures";

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

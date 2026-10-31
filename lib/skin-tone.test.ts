import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { findBannedWords } from "./banned";
import { DEMO_FACES, faceDir, loadDemo } from "./fixtures";
import { itaDeg, itaOf, labOf, TONE_ASSUMPTION, TONE_CITATIONS, toneOf, type ToneBand } from "./skin-tone";

describe("toneOf", () => {
  const cases: [number, ToneBand, number][] = [
    [70, "very_light", 1],
    [55.1, "very_light", 1],
    [55, "light", 1],
    [41.1, "light", 1],
    [41, "intermediate", 0.75],
    [28.1, "intermediate", 0.75],
    [28, "tan", 0.5],
    [10.1, "tan", 0.5],
    [10, "brown", 0.5],
    [-29.9, "brown", 0.5],
    [-30, "dark", 0.5],
    [-60, "dark", 0.5],
  ];
  for (const [ita, band, factor] of cases)
    test(`ita ${ita} -> ${band} x${factor}`, () => expect(toneOf(ita)).toEqual({ ita, band, factor }));
  test("ita rounds to 1 decimal", () => expect(toneOf(33.349).ita).toBe(33.3));
  test("citations and assumption are present and plain", () => {
    expect(TONE_CITATIONS.chardon.doi).toBe("10.1111/j.1467-2494.1991.tb00561.x");
    expect(TONE_CITATIONS.kaidbey.doi).toBe("10.1016/S0190-9622(79)70018-1");
    expect(TONE_ASSUMPTION).toMatch(/assumption/i);
    expect(findBannedWords([TONE_CITATIONS, TONE_ASSUMPTION])).toEqual([]);
  });
});

describe("colour maths", () => {
  test("sRGB white and black", () => {
    const w = labOf(255, 255, 255);
    expect(w.L).toBeCloseTo(100, 0);
    expect(Math.abs(w.a)).toBeLessThan(0.5);
    expect(Math.abs(w.b)).toBeLessThan(0.5);
    expect(labOf(0, 0, 0).L).toBeCloseTo(0, 1);
  });
  test("known sRGB values within 0.5", () => {
    const r = labOf(255, 0, 0); // 53.24, 80.09, 67.20
    expect(Math.abs(r.L - 53.24)).toBeLessThan(0.5);
    expect(Math.abs(r.a - 80.09)).toBeLessThan(0.5);
    expect(Math.abs(r.b - 67.2)).toBeLessThan(0.5);
    const g = labOf(128, 128, 128); // 53.59
    expect(Math.abs(g.L - 53.59)).toBeLessThan(0.5);
  });
  test("itaDeg = atan2(L-50, b)", () => {
    expect(itaDeg(50, 10)).toBeCloseTo(0, 5);
    expect(itaDeg(60, 10)).toBeCloseTo(45, 5);
  });
});

describe("itaOf", () => {
  const flat = (r: number, g: number, b: number) =>
    sharp({ create: { width: 100, height: 100, channels: 3, background: { r, g, b } } }).jpeg({ quality: 95 }).toBuffer();
  test("a lighter patch gives a higher ita than a darker one", async () => {
    expect((await itaOf(await flat(240, 200, 180))).ita).toBeGreaterThan((await itaOf(await flat(150, 100, 70))).ita);
  });
  test("pure white and black patches are filtered, not crashed on", async () => {
    await itaOf(await flat(255, 255, 255));
    await itaOf(await flat(0, 0, 0));
  });
  test("is deterministic", async () => {
    const j = await flat(200, 150, 120);
    expect(await itaOf(j)).toEqual(await itaOf(j));
  });
});

describe("stored tone per demo face", () => {
  for (const face of DEMO_FACES)
    test(`face ${face}: tone.json matches a fresh itaOf of input.jpg`, async () => {
      const dir = faceDir(face);
      const stored = JSON.parse(readFileSync(path.join(dir, "tone.json"), "utf8"));
      const fresh = await itaOf(readFileSync(path.join(dir, "input.jpg")));
      expect(stored.ita).toBe(fresh.ita);
      expect(loadDemo(face).tone).toEqual(toneOf(stored.ita));
    });
});

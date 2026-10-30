import { describe, expect, test } from "bun:test";
import { findBannedWords } from "./banned";
import { PRODUCTS, bagTotal, buildRoutine, formatPrice } from "./routine";
import type { UvBand } from "./uv-band";

const AMOUNT = "Two finger lengths, about ¼ teaspoon, for face and neck";

describe("buildRoutine bands", () => {
  const cases: [number, UvBand, 30 | 50, number | null, string, string][] = [
    [2.9, "low", 30, null, "SPF 30", "tinted"],
    [3, "moderate", 30, 2, "SPF 30", "mist"],
    [5.9, "moderate", 30, 2, "SPF 30", "mist"],
    [6, "high", 50, 2, "SPF 50", "stick"],
    [7.9, "high", 50, 2, "SPF 50", "stick"],
    [8, "very_high", 50, 2, "SPF 50", "stick"],
    [10.9, "very_high", 50, 2, "SPF 50", "stick"],
    [11, "extreme", 50, 2, "SPF 50", "stick"],
  ];
  for (const [uv, band, spf, hours, morning, midday] of cases) {
    test(`uv ${uv} -> ${band}`, () => {
      const r = buildRoutine(uv);
      expect(r.band).toBe(band);
      expect(r.spf).toBe(spf);
      expect(r.reapplyHours).toBe(hours);
      expect(r.amount).toBe(AMOUNT);
      expect(r.reapply).toBe(hours === null ? "No top-up needed on a city day" : "Top up every 2 hours outdoors");
      expect(r.steps[0].product.spf).toBe(spf);
      expect(r.steps[0].product.name).toContain(morning);
      expect(r.steps[1].product.spf).toBe(spf);
      expect(r.steps[1].product.format.toLowerCase()).toContain(midday);
    });
  }

  test("morning product differs between moderate and high", () => {
    expect(buildRoutine(5.9).steps[0].product.id).not.toBe(buildRoutine(6).steps[0].product.id);
    expect(buildRoutine(5.9).steps[0].product.format).toContain("lotion");
    expect(buildRoutine(6).steps[0].product.format).toContain("fluid");
  });

  test("negative and NaN input become 0", () => {
    for (const bad of [-4, NaN, Infinity, -Infinity]) {
      const r = buildRoutine(bad);
      expect(r.uv).toBe(0);
      expect(r.band).toBe("low");
      expect(r.spf).toBe(30);
      expect(r.reapplyHours).toBeNull();
    }
  });

  test("rounds uv to one decimal", () => {
    expect(buildRoutine(7.84).uv).toBe(7.8);
  });

  test("three steps in order with labels", () => {
    for (const uv of [0, 4, 7, 9, 12]) {
      const r = buildRoutine(uv);
      expect(r.steps.map((s) => s.id)).toEqual(["morning", "midday", "evening"]);
      expect(r.steps.map((s) => s.label)).toEqual(["Morning", "Midday top-up", "Evening"]);
      expect(r.steps[2].product.spf).toBeNull();
      expect(r.steps[2].product.id).toBe(buildRoutine(1).steps[2].product.id);
    }
  });

  test("why lines contain the rounded uv", () => {
    for (const s of buildRoutine(7.84).steps) expect(s.why).toContain("7.8");
    for (const s of buildRoutine(0).steps) expect(s.why).toContain("0");
  });
});

describe("catalogue", () => {
  test("products are well formed", () => {
    for (const [key, p] of Object.entries(PRODUCTS)) {
      expect(p.id).toBe(key);
      expect(p.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(p.priceCents).toBeGreaterThanOrEqual(1200);
      expect(p.priceCents).toBeLessThanOrEqual(3400);
    }
  });

  test("no banned words in products or any routine", () => {
    expect(findBannedWords(PRODUCTS)).toEqual([]);
    for (const uv of [0, 2.9, 4, 7, 9, 12]) expect(findBannedWords(buildRoutine(uv))).toEqual([]);
  });
});

describe("bagTotal", () => {
  test("counts duplicates and ignores unknown ids", () => {
    const [a, b] = Object.values(PRODUCTS);
    expect(bagTotal([a.id, a.id, b.id, "nope"])).toBe(a.priceCents * 2 + b.priceCents);
    expect(bagTotal([])).toBe(0);
    expect(bagTotal(["nope"])).toBe(0);
  });
});

describe("formatPrice", () => {
  test("whole and fractional euros", () => {
    expect(formatPrice(4600)).toBe("€46");
    expect(formatPrice(1250)).toBe("€12.50");
    expect(formatPrice(1205)).toBe("€12.05");
    expect(formatPrice(0)).toBe("€0");
  });
});

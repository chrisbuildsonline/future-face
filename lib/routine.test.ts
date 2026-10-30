import { describe, expect, test } from "bun:test";
import { findBannedWords } from "./banned";
import { GENERIC, type Kind, type Product as Item } from "./products";
import { routineFor } from "./routine";
import type { UvBand } from "./uv-band";

const AMOUNT = "Two finger lengths, about ¼ teaspoon, for face and neck";

const item = (code: string, kind: Kind, spf: number | null): Item => ({
  code,
  name: `${code} ${kind}`,
  brand: null,
  image: null,
  spf,
  kind,
  size: null,
  ingredients: "AQUA",
  url: null,
  source: "obf",
});
const CAT: Item[] = [
  item("c30", "cream", 30),
  item("c50", "cream", 50),
  item("f50", "fluid", 50),
  item("c60", "cream", 60),
  item("s30", "spray", 30),
  item("k50", "stick", 50),
  item("w1", "cleanser", null),
  item("w2", "cleanser", null),
];

describe("routineFor", () => {
  const cases: [number, UvBand, 30 | 50, string, string][] = [
    [2, "low", 30, "c30", "s30"],
    [5, "moderate", 30, "c30", "s30"],
    [8, "very_high", 50, "c50", "k50"],
    [11, "extreme", 50, "c50", "k50"],
  ];
  for (const [uv, band, spf, morning, midday] of cases) {
    test(`uv ${uv} -> SPF ${spf}`, () => {
      const r = routineFor(uv, CAT);
      expect(r.band).toBe(band);
      expect(r.spf).toBe(spf);
      expect(r.amount).toBe(AMOUNT);
      expect(r.reapplyHours).toBe(band === "low" ? null : 2);
      expect(r.reapply).toBe(band === "low" ? "No top-up needed on a city day" : "Top up every 2 hours outdoors");
      expect(r.steps.map((s) => s.id)).toEqual(["morning", "midday", "evening"]);
      expect(r.steps.map((s) => s.label)).toEqual(["Morning", "Midday top-up", "Evening"]);
      expect(r.steps[0].product.code).toBe(morning);
      expect(r.steps[1].product.code).toBe(midday);
      expect(r.steps[2].product.code).toBe("w1");
      expect(r.preferred).toBeNull();
      expect(r.fit).toBeNull();
      expect(r.steps[0].why).toContain(`SPF ${spf}`);
      expect(r.steps[0].why).toContain(`SPF ${CAT.find((p) => p.code === morning)!.spf}`);
      for (const s of r.steps) expect(s.why).toContain(String(r.uv));
    });
  }

  test("negative and NaN input become 0, uv rounds to one decimal", () => {
    for (const bad of [-4, NaN, Infinity, -Infinity]) {
      const r = routineFor(bad, CAT);
      expect(r.uv).toBe(0);
      expect(r.band).toBe("low");
      expect(r.spf).toBe(30);
      expect(r.reapplyHours).toBeNull();
    }
    expect(routineFor(7.84, CAT).uv).toBe(7.8);
  });

  test("morning is the closest spf at or above what is needed, ties in catalogue order", () => {
    const cat = [item("a", "cream", 60), item("b", "cream", 50), item("c", "fluid", 50), item("d", "cream", 30)];
    expect(routineFor(8, cat).steps[0].product.code).toBe("b");
    expect(routineFor(2, cat).steps[0].product.code).toBe("d");
  });

  test("midday ties go to catalogue order", () => {
    const cat = [item("s", "spray", 50), item("k", "stick", 50)];
    expect(routineFor(8, cat).steps[1].product.code).toBe("s");
  });

  test("prefer a valid SPF 50 at UV 8 -> morning, fit ok", () => {
    const r = routineFor(8, CAT, "c60");
    expect(r.preferred?.code).toBe("c60");
    expect(r.steps[0].product.code).toBe("c60");
    expect(r.fit).toEqual({ ok: true, line: "SPF 60 covers a UV 8 day" });
    expect(routineFor(8, CAT, "c50").fit).toEqual({ ok: true, line: "SPF 50 covers a UV 8 day" });
  });

  test("prefer an SPF 30 at UV 8 -> still morning, fit not ok", () => {
    const r = routineFor(8, CAT, "c30");
    expect(r.steps[0].product.code).toBe("c30");
    expect(r.fit).toEqual({ ok: false, line: "SPF 30 is under the SPF 50 a UV 8 day calls for" });
    expect(r.steps[0].why).toContain("SPF 30");
  });

  test("the preferred product is not reused as the second cream at midday", () => {
    const r = routineFor(8, [item("a", "cream", 50), item("b", "cream", 50)], "a");
    expect(r.steps.map((s) => s.product.code)).toEqual(["a", "b"]);
  });

  test("unknown, invalid, cleanser or empty prefer is ignored", () => {
    const base = routineFor(8, CAT);
    for (const bad of ["nope", "", null, undefined, "w1", "../x"]) {
      const r = routineFor(8, CAT, bad);
      expect(r.preferred).toBeNull();
      expect(r.fit).toBeNull();
      expect(r.steps.map((s) => s.product.code)).toEqual(base.steps.map((s) => s.product.code));
    }
  });

  test("generic catalogue works", () => {
    const hi = routineFor(8, GENERIC);
    expect(hi.steps).toHaveLength(3);
    expect(hi.steps[0].product.spf).toBe(50);
    expect(hi.steps[1].product.kind).toBe("stick");
    expect(hi.steps[2].product.kind).toBe("cleanser");
    expect(routineFor(2, GENERIC).steps[0].product.spf).toBe(30);
    expect(findBannedWords(hi)).toEqual([]);
  });

  test("a catalogue with no sticks or cleansers does not throw", () => {
    const cat = [item("a", "cream", 30), item("b", "cream", 50)];
    for (const uv of [0, 2, 5, 8, 11, NaN, -3]) {
      const r = routineFor(uv, cat);
      expect(r.steps[0].product.kind).toBe("cream");
      expect(r.steps.map((s) => s.id)).toEqual(["morning", "midday"]);
    }
    expect(routineFor(8, cat).steps.map((s) => s.product.code)).toEqual(["b", "a"]);
  });

  test("an empty or sunscreen-less catalogue does not throw", () => {
    expect(routineFor(8, []).steps).toEqual([]);
    expect(routineFor(8, [item("w", "cleanser", null)]).steps.map((s) => s.id)).toEqual(["evening"]);
  });

  test("only low spf available still gives a morning product", () => {
    const r = routineFor(8, [item("a", "cream", 30)]);
    expect(r.steps[0].product.code).toBe("a");
    expect(r.preferred).toBeNull();
  });
});

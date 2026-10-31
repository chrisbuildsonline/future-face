import { describe, expect, test } from "bun:test";
import { demoResult } from "./pipeline";
import { defaultYears } from "./horizons";

describe("horizons", () => {
  test("face a has both horizons and defaults to +30", () => {
    const a = demoResult(undefined, "a").horizons;
    expect(a.map((h) => h.years)).toEqual([20, 30]);
    expect(defaultYears(a)).toBe(30);
  });

  test("face b has only +20, which is the default", () => {
    const b = demoResult(undefined, "b").horizons;
    expect(b.map((h) => h.years)).toEqual([20]);
    expect(defaultYears(b)).toBe(20);
  });

  test("order does not matter and none at all is 0", () => {
    expect(defaultYears([{ years: 30 }, { years: 20 }])).toBe(30);
    expect(defaultYears([])).toBe(0);
  });
});

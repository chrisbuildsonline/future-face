import { describe, expect, test } from "bun:test";
import { demoResult } from "./pipeline";
import { defaultYears, horizonSlots } from "./horizons";

describe("horizons", () => {
  test("face a has both horizons and defaults to +30", () => {
    const a = demoResult(undefined, "a").horizons;
    expect(horizonSlots(a)).toEqual([
      { years: 20, available: true },
      { years: 30, available: true },
    ]);
    expect(defaultYears(a)).toBe(30);
  });

  test("face b has only +20: +30 is offered as unavailable and +20 is the default", () => {
    const b = demoResult(undefined, "b").horizons;
    expect(horizonSlots(b)).toEqual([
      { years: 20, available: true },
      { years: 30, available: false },
    ]);
    expect(defaultYears(b)).toBe(20);
  });

  test("order does not matter, an extra horizon is kept, and none at all is 0", () => {
    expect(defaultYears([{ years: 30 }, { years: 20 }])).toBe(30);
    expect(horizonSlots([{ years: 10 }]).map((s) => s.years)).toEqual([10, 20, 30]);
    expect(defaultYears([])).toBe(0);
    expect(horizonSlots([]).every((s) => !s.available)).toBe(true);
  });
});

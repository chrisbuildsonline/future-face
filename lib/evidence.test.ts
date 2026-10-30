import { describe, expect, test } from "bun:test";
import { CITATION, INTENSITIES, SPF_AGING_REDUCTION, SPF_SETTINGS } from "./evidence";

describe("evidence", () => {
  test("SPF settings values", () => {
    expect(SPF_SETTINGS).toEqual({ spots: 0.24, wrinkle: 0.24, texture: 0.24 });
  });

  test("SPF arm ages 24% less, from the trial", () => {
    expect(SPF_AGING_REDUCTION).toBe(0.24);
    expect(CITATION.finding).toContain("24% less aging");
  });

  test("every intensity is in 0..1, matches SPF_SETTINGS and carries the citation", () => {
    expect(INTENSITIES.map((i) => i.key as string).sort()).toEqual(Object.keys(SPF_SETTINGS).sort());
    for (const i of INTENSITIES) {
      expect(i.value).toBeGreaterThanOrEqual(0);
      expect(i.value).toBeLessThanOrEqual(1);
      expect(i.value).toBe(SPF_SETTINGS[i.key]);
      expect(i.citation).toBe(CITATION);
      expect(i.basis).toContain("Hughes 2013");
    }
    expect(Object.fromEntries(INTENSITIES.map((i) => [i.key, i.analysisKey]))).toEqual({
      spots: "age_spot",
      wrinkle: "wrinkle",
      texture: "texture",
    });
    expect(CITATION.doi).toBe("10.7326/0003-4819-158-11-201306040-00002");
  });
});

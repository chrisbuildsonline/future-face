import { describe, expect, test } from "bun:test";
import { CITATION, DOSE_STEPS, INTENSITIES, TRIAL_INTENSITY, simSettings, spfDose } from "./evidence";
import { recordedUv, type Uv } from "./uv";

const at = (uvMax: number): Uv => ({ ...recordedUv(), city: "Lisbon", uvMax, source: "live" });

describe("evidence", () => {
  test("trial base intensity and steps", () => {
    expect(TRIAL_INTENSITY).toBe(0.24);
    expect(DOSE_STEPS).toEqual([0.12, 0.24, 0.36, 0.48, 0.6]);
    expect(CITATION.finding).toContain("24% less aging");
  });

  test("simSettings sets all three Skin Simulation sliders to the intensity", () => {
    expect(simSettings(0.36)).toEqual({ spots: 0.36, wrinkle: 0.36, texture: 0.36 });
  });

  test("every intensity row describes the base, carries the citation and the UV basis", () => {
    expect(INTENSITIES.map((i) => i.key).sort()).toEqual(["spots", "texture", "wrinkle"]);
    for (const i of INTENSITIES) {
      expect(i.value).toBe(TRIAL_INTENSITY);
      expect(i.citation).toBe(CITATION);
      expect(i.basis).toContain("Hughes 2013");
      expect(i.basis).toContain("Nambour");
      expect(i.basis).not.toMatch(/years/);
    }
    expect(Object.fromEntries(INTENSITIES.map((i) => [i.key, i.analysisKey]))).toEqual({
      spots: "age_spot",
      wrinkle: "wrinkle",
      texture: "texture",
    });
    expect(CITATION.doi).toBe("10.7326/0003-4819-158-11-201306040-00002");
  });
});

describe("spfDose", () => {
  const rec = recordedUv();
  const cases: [number, number, number][] = [
    // uvMax, ratio, intensity (Nambour reference is 7.8)
    [0, 0.5, 0.12],
    [3.9, 0.5, 0.12],
    [7.8, 1, 0.24],
    [11.7, 1.5, 0.36],
    [13.65, 2, 0.48], // 1.75 rounds up to 2
    [15.6, 2, 0.48],
    [30, 2.5, 0.6],
  ];
  for (const [uvMax, ratio, intensity] of cases) {
    test(`uvMax ${uvMax} -> ratio ${ratio}, intensity ${intensity}`, () => {
      const d = spfDose(at(uvMax));
      expect(d.ratio).toBe(ratio);
      expect(d.intensity).toBe(intensity);
      expect(DOSE_STEPS).toContain(d.intensity);
      expect(d.cityUv).toBe(uvMax);
      expect(d.cityName).toBe("Lisbon");
    });
  }

  test("reference is the recorded Nambour reading", () => {
    const d = spfDose(at(5));
    expect(d.referenceCity).toBe("Nambour");
    expect(d.referenceUv).toBe(rec.uvMax);
    expect(d.referenceDate).toBe(rec.date);
  });

  test("null city uv uses the recorded reading: ratio 1, 0.24", () => {
    const d = spfDose(null);
    expect(d).toMatchObject({ cityUv: rec.uvMax, cityName: "Nambour", ratio: 1, intensity: 0.24 });
  });
});

// Skin-simulation intensity for the "daily SPF" arm, with the study it comes from.
import type { SkinTone } from "./tone";
import { recordedUv, type Uv } from "./uv";

/** Skin Simulation intensity at the trial site's UV (Hughes 2013: 24% less skin aging with daily sunscreen). */
export const TRIAL_INTENSITY = 0.24;

export const CITATION = {
  text: "Hughes MCB, Williams GM, Baker P, Green AC. Sunscreen and prevention of skin aging: a randomized trial. Ann Intern Med. 2013;158(11):781-790.",
  doi: "10.7326/0003-4819-158-11-201306040-00002",
  finding:
    "Daily sunscreen users showed no detectable increase in skin aging after 4.5 years and 24% less aging than discretionary users.",
};

/** The five intensities a request can land on: TRIAL_INTENSITY x (0.5 .. 2.5). */
export const DOSE_STEPS = [0.12, 0.24, 0.36, 0.48, 0.6];

const round2 = (n: number) => Math.round(n * 100) / 100;

export type SpfDose = {
  cityUv: number;
  cityName: string;
  referenceUv: number;
  referenceCity: "Nambour";
  referenceDate: string;
  /** City UV / Nambour UV, before the tone factor and rounding. */
  uvRatio: number;
  tone: SkinTone | null;
  ratio: number;
  intensity: number;
};

/** Intensity = 0.24 x (city UV / Nambour UV x skin tone factor), the ratio rounded to the nearest 0.5 and kept within 0.5..2.5. A null city uses the recorded Nambour reading; a null tone is factor 1. */
export function spfDose(cityUv: Uv | null, tone: SkinTone | null = null): SpfDose {
  const ref = recordedUv();
  const city = cityUv ?? ref;
  const uvRatio = city.uvMax / ref.uvMax;
  const half = Math.round(+(uvRatio * (tone?.factor ?? 1) * 2).toFixed(6)); // toFixed: 13.65 / 7.8 must tie to 3.5, not 3.4999999
  const ratio = Math.min(2.5, Math.max(0.5, half / 2));
  return {
    cityUv: city.uvMax,
    cityName: city.city,
    referenceUv: ref.uvMax,
    referenceCity: "Nambour",
    referenceDate: ref.date,
    uvRatio: round2(uvRatio),
    tone,
    ratio,
    intensity: round2(TRIAL_INTENSITY * ratio),
  };
}

/** What goes to Skin Simulation for one request. */
export const simSettings = (intensity: number) => ({ spots: intensity, wrinkle: intensity, texture: intensity });

const basis = "Skin Simulation intensity = 0.24 (24% less skin aging with daily sunscreen, Hughes 2013) x (your UV / Nambour UV, the trial site) x a skin tone factor (1 for fair skin, lower for darker tones: a model assumption)";

export const INTENSITIES = [
  { key: "spots", value: TRIAL_INTENSITY, analysisKey: "age_spot", citation: CITATION, basis },
  { key: "wrinkle", value: TRIAL_INTENSITY, analysisKey: "wrinkle", citation: CITATION, basis },
  { key: "texture", value: TRIAL_INTENSITY, analysisKey: "texture", citation: CITATION, basis },
] as const;

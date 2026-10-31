// Skin tone bands and dose factors: the pure half of skin-tone.ts, safe for client bundles (no sharp).

export type ToneBand = "very_light" | "light" | "intermediate" | "tan" | "brown" | "dark";
export type SkinTone = { ita: number; band: ToneBand; factor: number };

export const TONE_CITATIONS = {
  chardon: {
    text: "Chardon A, Cretois I, Hourseau C. Skin colour typology and suntanning pathways. Int J Cosmet Sci. 1991;13(4):191-208.",
    doi: "10.1111/j.1467-2494.1991.tb00561.x",
  },
  kaidbey: {
    text: "Kaidbey KH, Agin PP, Sayre RM, Kligman AM. Photoprotection by melanin, a comparison of black and Caucasian skin. J Am Acad Dermatol. 1979;1(3):249-260.",
    doi: "10.1016/S0190-9622(79)70018-1",
  },
};

export const TONE_ASSUMPTION =
  "The tone factors are a model assumption, not a trial result: the trial figure is anchored at fair skin and darker tones scale it down.";

const FACTOR: Record<ToneBand, number> = { very_light: 1, light: 1, intermediate: 0.75, tan: 0.5, brown: 0.5, dark: 0.5 };

/** Chardon 1991 bands on ITA degrees. */
export function toneOf(ita: number): SkinTone {
  const band: ToneBand =
    ita > 55 ? "very_light" : ita > 41 ? "light" : ita > 28 ? "intermediate" : ita > 10 ? "tan" : ita > -30 ? "brown" : "dark";
  return { ita: Math.round(ita * 10) / 10, band, factor: FACTOR[band] };
}

/**
 * A display colour on the measured ITA line, for a small swatch: ITA = atan((L* - 50) / b*), so at a typical
 * skin b* of 18 and a* of 12, L* = 50 + 18 tan(ITA). Illustrative only; the dose uses the ITA, not this colour.
 */
export function toneSwatch(ita: number): string {
  const b = 18;
  const L = Math.max(20, Math.min(90, 50 + b * Math.tan((ita * Math.PI) / 180)));
  return `lab(${L.toFixed(1)}% 12 ${b})`;
}

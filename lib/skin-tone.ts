// Skin tone as Individual Typology Angle (ITA), used to scale the SPF dose. Server only (sharp).
// The bands, factors and citations are pure and live in ./tone (client bundles import them from there).
import sharp from "sharp";
import { toneOf, type SkinTone } from "./tone";

export { TONE_ASSUMPTION, TONE_CITATIONS, toneOf, type SkinTone, type ToneBand } from "./tone";

/** One 8-bit sRGB colour to CIELAB (D65). */
export function labOf(r: number, g: number, b: number): { L: number; a: number; b: number } {
  const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const X = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047;
  const Y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B;
  const Z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const [fx, fy, fz] = [f(X), f(Y), f(Z)];
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** ITA in degrees: atan2(L* - 50, b*). */
export const itaDeg = (L: number, b: number) => (Math.atan2(L - 50, b) * 180) / Math.PI;

/** Median ITA of a central cheek/nose patch of a face crop, ignoring shadow and highlight pixels. */
export async function itaOf(jpeg: Uint8Array): Promise<SkinTone> {
  const img = sharp(jpeg).rotate();
  const { width = 1, height = 1 } = await sharp(await img.toBuffer()).metadata();
  const left = Math.floor(width * 0.35);
  const top = Math.floor(height * 0.4);
  const { data, info } = await img
    .extract({
      left,
      top,
      width: Math.max(1, Math.floor(width * 0.65) - left),
      height: Math.max(1, Math.floor(height * 0.62) - top),
    })
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  const itas: number[] = [];
  for (let i = 0; i < info.width * info.height; i++) {
    const { L, b } = labOf(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);
    if (L >= 25 && L <= 95) itas.push(itaDeg(L, b));
  }
  if (!itas.length) return toneOf(50); // nothing usable: the trial-anchored factor, never a guess below it
  itas.sort((x, y) => x - y);
  const mid = itas.length >> 1;
  return toneOf(itas.length % 2 ? itas[mid] : (itas[mid - 1] + itas[mid]) / 2);
}

// Pure (no node imports) so client components can use it.

export type UvBand = "low" | "moderate" | "high" | "very_high" | "extreme";

/** WHO UV index bands. */
export function uvBand(uv: number): UvBand {
  if (uv < 3) return "low";
  if (uv < 6) return "moderate";
  if (uv < 8) return "high";
  if (uv < 11) return "very_high";
  return "extreme";
}

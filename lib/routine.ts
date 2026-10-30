// A sunscreen routine sized to the day's UV index. Fictional catalogue, one invented house name.
// Pure (no node imports) so client components can use it.
import { uvBand, type UvBand } from "./uv-band";

export type StepId = "morning" | "midday" | "evening";
export type Product = { id: string; name: string; format: string; size: string; priceCents: number; spf: 30 | 50 | null };
export type RoutineStep = { id: StepId; label: string; product: Product; why: string };
export type Routine = {
  uv: number;
  band: UvBand;
  spf: 30 | 50;
  amount: string;
  reapplyHours: number | null;
  reapply: string;
  steps: RoutineStep[];
};

const list: Product[] = [
  { id: "daily-lotion-30", name: "Daily Lotion SPF 30", format: "daily lotion", size: "50 ml", priceCents: 2400, spf: 30 },
  { id: "noon-fluid-50", name: "Noon Fluid SPF 50", format: "light fluid", size: "40 ml", priceCents: 3200, spf: 50 },
  { id: "tint-compact-30", name: "Tint Compact SPF 30", format: "tinted compact", size: "10 g", priceCents: 2800, spf: 30 },
  { id: "veil-mist-30", name: "Veil Mist SPF 30", format: "setting mist", size: "75 ml", priceCents: 1900, spf: 30 },
  { id: "glide-stick-50", name: "Glide Stick SPF 50", format: "stick for over make-up", size: "15 g", priceCents: 2200, spf: 50 },
  { id: "dusk-balm", name: "Dusk Cleansing Balm", format: "cleansing balm", size: "100 ml", priceCents: 1400, spf: null },
];

export const PRODUCTS: Record<string, Product> = Object.fromEntries(list.map((p) => [p.id, p]));

const AMOUNT = "Two finger lengths, about ¼ teaspoon, for face and neck";

export function buildRoutine(uv: number): Routine {
  const rounded = Number.isFinite(uv) && uv > 0 ? Math.round(uv * 10) / 10 : 0;
  const band = uvBand(rounded);
  const high = band === "high" || band === "very_high" || band === "extreme";
  const spf = high ? 50 : 30;
  const reapplyHours = band === "low" ? null : 2;
  const word = band.replace("_", " ");

  const morning = PRODUCTS[high ? "noon-fluid-50" : "daily-lotion-30"];
  const midday = PRODUCTS[high ? "glide-stick-50" : band === "low" ? "tint-compact-30" : "veil-mist-30"];
  const evening = PRODUCTS["dusk-balm"];

  const middayWhy = high
    ? `UV ${rounded} is ${word}, so a stick tops up SPF 50 over make-up.`
    : band === "low"
      ? `UV ${rounded} is ${word}, so a tinted touch-up is optional.`
      : `UV ${rounded} is ${word}, so a light mist keeps SPF 30 topped up.`;

  return {
    uv: rounded,
    band,
    spf,
    amount: AMOUNT,
    reapplyHours,
    reapply: reapplyHours === null ? "No top-up needed on a city day" : "Top up every 2 hours outdoors",
    steps: [
      { id: "morning", label: "Morning", product: morning, why: `UV ${rounded} is ${word}, so start with SPF ${spf}.` },
      { id: "midday", label: "Midday top-up", product: midday, why: middayWhy },
      { id: "evening", label: "Evening", product: evening, why: `After a UV ${rounded} day, a balm lifts the sunscreen away.` },
    ],
  };
}

export function bagTotal(ids: string[]): number {
  return ids.reduce((sum, id) => sum + (PRODUCTS[id]?.priceCents ?? 0), 0);
}

export function formatPrice(cents: number): string {
  const euros = cents / 100;
  return cents % 100 === 0 ? `€${euros}` : `€${euros.toFixed(2)}`;
}

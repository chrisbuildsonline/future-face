// A sunscreen routine sized to the day's UV index, built from a product catalogue (lib/products.ts).
// Pure (no node imports) so client components can use it.
import type { Product } from "./products";
import { uvBand, type UvBand } from "./uv-band";

export type StepId = "morning" | "midday" | "evening";
export type RoutineStep = { id: StepId; label: string; product: Product; why: string };
export type Routine = {
  uv: number;
  band: UvBand;
  spf: 30 | 50;
  amount: string;
  reapplyHours: number | null;
  reapply: string;
  steps: RoutineStep[];
  preferred: Product | null;
  fit: { ok: boolean; line: string } | null;
};

const AMOUNT = "Two finger lengths, about ¼ teaspoon, for face and neck";

/** The day-sized routine built from a product catalogue. A kind the catalogue lacks drops its step; it never throws. */
export function routineFor(uv: number, catalogue: Product[], prefer?: string | null): Routine {
  const rounded = Number.isFinite(uv) && uv > 0 ? Math.round(uv * 10) / 10 : 0;
  const band = uvBand(rounded);
  const high = band === "high" || band === "very_high" || band === "extreme";
  const spf = high ? 50 : 30;
  const reapplyHours = band === "low" ? null : 2;
  const word = band.replace("_", " ");

  const sun = catalogue.filter((p) => p.kind !== "cleanser" && p.spf !== null);
  const body = sun.filter((p) => p.kind === "cream" || p.kind === "fluid");
  const hold = sun.filter((p) => p.kind === "stick" || p.kind === "spray");
  // Lowest spf that still covers the day; ties keep catalogue order.
  const closest = (list: Product[]) =>
    list.filter((p) => p.spf! >= spf).reduce<Product | null>((best, p) => (best && best.spf! <= p.spf! ? best : p), null);

  const preferred = (prefer && catalogue.find((p) => p.code === prefer && p.kind !== "cleanser" && p.spf !== null)) || null;
  const morning = preferred ?? closest(body) ?? closest(sun) ?? body[0] ?? sun[0] ?? null;
  const rest = sun.filter((p) => p !== morning);
  const midday = closest(hold) ?? hold[0] ?? closest(body.filter((p) => p !== morning)) ?? rest[0] ?? morning;
  const evening = catalogue.find((p) => p.kind === "cleanser") ?? null;

  const noun = midday?.kind === "stick" ? "a stick" : midday?.kind === "spray" ? "a light mist" : "a second layer";
  const middayWhy = high
    ? `UV ${rounded} is ${word}, so ${noun} tops up SPF 50 over make-up.`
    : band === "low"
      ? `UV ${rounded} is ${word}, so a touch-up is optional.`
      : `UV ${rounded} is ${word}, so ${noun} keeps SPF 30 topped up.`;

  const steps: RoutineStep[] = [];
  if (morning)
    steps.push({
      id: "morning",
      label: "Morning",
      product: morning,
      why: `UV ${rounded} is ${word}, so start with SPF ${spf}. This one is SPF ${morning.spf}.`,
    });
  if (midday) steps.push({ id: "midday", label: "Midday top-up", product: midday, why: middayWhy });
  if (evening)
    steps.push({ id: "evening", label: "Evening", product: evening, why: `After a UV ${rounded} day, a cleanser lifts the sunscreen away.` });

  const fit =
    preferred && preferred.spf !== null
      ? preferred.spf >= spf
        ? { ok: true, line: `SPF ${preferred.spf} covers a UV ${rounded} day` }
        : { ok: false, line: `SPF ${preferred.spf} is under the SPF ${spf} a UV ${rounded} day calls for` }
      : null;

  return {
    uv: rounded,
    band,
    spf,
    amount: AMOUNT,
    reapplyHours,
    reapply: reapplyHours === null ? "No top-up needed on a city day" : "Top up every 2 hours outdoors",
    steps,
    preferred,
    fit,
  };
}

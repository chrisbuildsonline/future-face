// Pure horizon logic, safe for client components (no node imports).

/** The horizons every run asks for; a recorded demo face can have fewer. */
export const HORIZON_YEARS = [20, 30] as const;

type Has = readonly { years: number }[];

/** Every horizon to offer, in order, marked by whether this result has it recorded. */
export function horizonSlots(have: Has) {
  const years = [...new Set([...HORIZON_YEARS, ...have.map((h) => h.years)])].sort((a, b) => a - b);
  return years.map((y) => ({ years: y, available: have.some((h) => h.years === y) }));
}

/** The longest horizon the result actually has; 0 when it has none. */
export const defaultYears = (have: Has) => Math.max(0, ...have.map((h) => h.years));

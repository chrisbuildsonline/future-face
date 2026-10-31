// Pure horizon logic, safe for client components (no node imports).

/** The horizons every run asks for; a recorded demo face can have fewer. */
export const HORIZON_YEARS = [20, 30] as const;

type Has = readonly { years: number }[];

/** The longest horizon the result actually has; 0 when it has none. */
export const defaultYears = (have: Has) => Math.max(0, ...have.map((h) => h.years));

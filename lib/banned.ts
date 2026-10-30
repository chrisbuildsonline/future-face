// Non-medical copy rule: these word stems must never appear on screen.
const BANNED = /\b(damag|risk|cancer|diagnos|prognos|cure|treat|disease)[a-z]*/gi;

// The one sanctioned use of a banned stem: the disclaimer that a render is
// "an illustrative projection, not a prognosis". Only that exact phrase is exempt.
const ALLOWED_PHRASE = /\bnot a prognosis\b/gi;

function collectStrings(value: unknown, out: string[]): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const v of value) collectStrings(v, out);
  else if (value && typeof value === "object")
    for (const v of Object.values(value)) collectStrings(v, out);
  return out;
}

/** Returns every banned word (lower-cased) found in any string inside `value`. */
export function findBannedWords(value: unknown): string[] {
  const found: string[] = [];
  for (const s of collectStrings(value, [])) {
    const scrubbed = s.replace(ALLOWED_PHRASE, " ");
    for (const m of scrubbed.matchAll(BANNED)) found.push(m[0].toLowerCase());
  }
  return found;
}

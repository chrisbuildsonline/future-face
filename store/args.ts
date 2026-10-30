// The Future Face app address for the widget: --url <url> or --url=<url>, then FF_URL, then localhost:3000.
export function ffUrl(argv: string[], env: string | undefined): string {
  const i = argv.findIndex((a) => a === "--url" || a.startsWith("--url="));
  const raw = i < 0 ? env || "http://localhost:3000" : argv[i].startsWith("--url=") ? argv[i].slice(6) : argv[i + 1];
  let ok = false;
  try { ok = /^https?:$/.test(new URL(raw).protocol); } catch {}
  if (!ok) throw new Error(`invalid app url: ${raw ?? "(missing)"} (need http:// or https://)`);
  return raw;
}

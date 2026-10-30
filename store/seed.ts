// Imports fixtures/products.json into the running shop. Safe to rerun: existing SKUs are skipped.
// The import itself is store/seed.php (one wp-cli process instead of one per product).
import { resolve } from "node:path";
import { copyIn, REPO_DIR, STORE_DIR, wp } from "./compose";

export async function seed(): Promise<string> {
  await copyIn(resolve(STORE_DIR, "seed.php"), "/tmp/seed.php");
  await copyIn(resolve(REPO_DIR, "fixtures/products.json"), "/tmp/products.json");
  await copyIn(resolve(REPO_DIR, "public/products"), "/tmp");

  const r = await wp(["eval-file", "/tmp/seed.php"]);
  if (r.code !== 0) throw new Error(`seed failed:\n${r.out}${r.err}`);
  process.stdout.write(r.out);

  const url = r.out.match(/^SPF50_URL=(.*)$/m)?.[1]?.trim() ?? "";
  if (!url) throw new Error("seeded, but no SPF 50 product was found in fixtures/products.json");
  return url;
}

if (import.meta.main) {
  console.log(`SPF 50 product: ${await seed()}`);
}

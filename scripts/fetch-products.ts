// Refreshes fixtures/products.json and public/products/*.jpg from Open Beauty Facts (free, no key).
// Run: bun run products. Picks are sorted by code so reruns on the same data are stable.
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { mapObf, type Product } from "../lib/products";

const API = "https://world.openbeautyfacts.org/api/v2/search";
const HEADERS = { "User-Agent": "FutureFace/0.1 (hackathon; github.com/chrisbuildsonline/future-face)" };
const FIELDS = "code,product_name,product_name_en,lang,brands,image_front_url,ingredients_text,quantity,categories_tags";
const root = path.join(import.meta.dir, "..");
const imageDir = path.join(root, "public", "products");

async function search(tag: string, pages: number): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let page = 1; page <= pages; page++) {
    const res = await fetch(`${API}?categories_tags=${tag}&fields=${FIELDS}&page_size=100&page=${page}`, { headers: HEADERS });
    if (!res.ok) throw new Error(`Open Beauty Facts ${tag} page ${page}: HTTP ${res.status}`);
    out.push(...((await res.json()).products ?? []));
  }
  return out;
}

/** Saves the front image as a JPEG of at most 600 px; false when it can't be fetched. */
async function saveImage(url: string, code: string): Promise<boolean> {
  for (const u of [url.replace(/\.\d+\.jpg$/, ".full.jpg"), url]) {
    try {
      const res = await fetch(u, { headers: HEADERS });
      if (!res.ok) continue;
      const jpeg = await sharp(Buffer.from(await res.arrayBuffer()))
        .rotate()
        .resize({ width: 600, height: 600, fit: "inside", withoutEnlargement: true })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: 80 })
        .toBuffer();
      writeFileSync(path.join(imageDir, `${code}.jpg`), jpeg);
      return true;
    } catch {}
  }
  return false;
}

// Records with wrong source data: 3337872411083 is an Effaclar cleanser labelled brand "Alani", 13045812 has the brand typo "Sum Bum".
const EXCLUDE = new Set(["3337872411083", "13045812"]);

type Candidate ={ product: Product; imageUrl: string };

// English-looking names only: plain ASCII, and no baby/kids lines or cleanser-adjacent items.
function candidates(raw: Record<string, unknown>[]): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const r of raw) {
    const product = mapObf(r);
    if (!product || !product.brand || EXCLUDE.has(product.code)) continue;
    const english = r.lang === "en" || /\b(stick|spray|cream|lotion|sunscreen|fluid|cleanser)\b/i.test(product.name);
    if (!english || !/^[\x20-\x7e]+$/.test(product.name)) continue;
    if (/\boil\b/i.test(product.name)) continue;
    if (/baby|babies|kids?|child/i.test(`${product.brand} ${product.name}`)) continue;
    if (product.kind === "cleanser" && (!/cleans|wash|micellar|foam/i.test(product.name) || /remover|scrub|strip|soap|nail|wipe|pad/i.test(product.name))) continue;
    const key = product.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ product, imageUrl: String(r.image_front_url) });
  }
  return out.sort((a, b) => (a.product.code < b.product.code ? -1 : 1));
}

const body = (p: Product) => p.kind === "cream" || p.kind === "fluid";
const hold = (p: Product) => p.kind === "stick" || p.kind === "spray";
const buckets: [string, number, (p: Product) => boolean][] = [
  ["cream or fluid, SPF 50+", 5, (p) => body(p) && p.spf! >= 50],
  ["cream or lotion, SPF 30-49", 3, (p) => body(p) && p.spf! < 50],
  ["stick, SPF 50+", 1, (p) => p.kind === "stick" && p.spf! >= 50],
  ["spray, SPF 50+", 1, (p) => p.kind === "spray" && p.spf! >= 50],
  ["stick or spray, SPF 30-49", 1, (p) => hold(p) && p.spf! < 50],
  ["face cleanser", 3, (p) => p.kind === "cleanser"],
];

const sun = candidates(await search("en:sunscreens", 4));
const wash = candidates(await search("en:cleansers", 2));
const pool = [...sun, ...wash];
mkdirSync(imageDir, { recursive: true });

const picked = new Map<string, Product>();
for (const [label, quota, match] of buckets) {
  let got = 0;
  for (const c of pool) {
    if (got === quota) break;
    if (picked.has(c.product.code) || !match(c.product)) continue;
    if (!(await saveImage(c.imageUrl, c.product.code))) continue;
    picked.set(c.product.code, c.product);
    got++;
  }
  if (got < quota) throw new Error(`Only ${got} of ${quota} for: ${label}`);
}

for (const file of readdirSync(imageDir)) if (!picked.has(file.replace(/\.jpg$/, ""))) unlinkSync(path.join(imageDir, file));

const products = [...picked.values()].sort((a, b) => (a.code < b.code ? -1 : 1));
writeFileSync(
  path.join(root, "fixtures", "products.json"),
  JSON.stringify(
    { source: "Open Beauty Facts", license: "Data ODbL 1.0, images CC BY-SA 3.0", fetchedAt: new Date().toISOString(), products },
    null,
    2,
  ) + "\n",
);
for (const p of products) console.log(p.code, p.kind.padEnd(8), String(p.spf ?? "-").padEnd(3), p.brand, "|", p.name);

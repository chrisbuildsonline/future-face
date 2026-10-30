// Products for the SPF routine: real ones from Open Beauty Facts (fixtures/products.json) or the fictional GENERIC set.
// Pure (no node imports) so client components can use it.

export type Kind = "cream" | "fluid" | "stick" | "spray" | "cleanser";
export type Product = {
  code: string;
  name: string;
  brand: string | null;
  image: string | null;
  spf: number | null;
  kind: Kind;
  size: string | null;
  ingredients: string;
  url: string | null;
  source: "obf" | "generic";
};

/** Brand and name on one line. Many Open Beauty Facts names already start with the brand: then the name alone. */
export function productLabel(p: Pick<Product, "brand" | "name">): string {
  const brand = p.brand?.trim() ?? "";
  const name = p.name.trim();
  if (!brand) return name;
  const head = name.slice(0, brand.length);
  const next = name.charAt(brand.length);
  const has = head.toLowerCase() === brand.toLowerCase() && !/[\p{L}\p{N}]/u.test(next);
  return has ? name : `${brand} ${name}`;
}

export function isCode(s: string): boolean {
  return /^\d{8,14}$/.test(s);
}

/** SPF from a product name: "SPF 50", "SPF50+", "FPS 50", "LSF 30", "IP 50", "50+SPF". 50+ is 50; UPF is ignored; only 2..100. */
export function parseSpf(text: string): number | null {
  const found = [
    ...text.matchAll(/(?<![a-z])(?:spf|fps|lsf|ip)\s*[-:]?\s*(\d{1,3})(?!\d)/gi),
    ...text.matchAll(/(?<![\d.])(\d{1,3})\s*\+?\s*spf(?![a-z])/gi),
  ];
  for (const m of found) {
    const n = Number(m[1]);
    if (n >= 2 && n <= 100) return n;
  }
  return null;
}

export function kindOf(name: string, categories: string[]): Kind {
  const cats = categories.join(" ").toLowerCase();
  const n = name.toLowerCase();
  if (/cleans|micellar/.test(cats) || /cleans|micellar|face wash|facewash/.test(n)) return "cleanser";
  if (/\bstick\b/.test(n) || /\bstick/.test(cats)) return "stick";
  if (/spray|\bmist\b/.test(n) || /spray/.test(cats)) return "spray";
  if (/fluid|serum|\bgel\b|essence|jelly/.test(n)) return "fluid";
  return "cream";
}

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** One Open Beauty Facts record to a Product, or null unless it is a complete sunscreen (SPF 30+) or face cleanser. */
export function mapObf(raw: unknown): Product | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const code = text(r.code);
  const name = text(r.product_name) || text(r.product_name_en);
  const ingredients = text(r.ingredients_text);
  if (!isCode(code) || !name || !ingredients || !text(r.image_front_url)) return null;

  const categories = Array.isArray(r.categories_tags) ? r.categories_tags.filter((c): c is string => typeof c === "string") : [];
  const kind = kindOf(name, categories);
  const spf = kind === "cleanser" ? null : parseSpf(name);
  if (kind !== "cleanser" && (spf === null || spf < 30)) return null;

  return {
    code,
    name,
    brand: text(r.brands).split(",")[0].trim() || null,
    image: `/products/${code}.jpg`,
    spf,
    kind,
    size: text(r.quantity) || null,
    ingredients,
    url: `https://world.openbeautyfacts.org/product/${code}`,
    source: "obf",
  };
}

/** The product the store preview and landing link open on: the first SPF 50+ cream, else the first sunscreen. */
export function storeProduct(list: Product[]): Product | null {
  return list.find((p) => p.kind === "cream" && (p.spf ?? 0) >= 50) ?? list.find((p) => p.spf !== null) ?? null;
}

const fictional = (code: string, name: string, kind: Kind, spf: number | null, size: string): Product => ({
  code,
  name,
  brand: null,
  image: null,
  spf,
  kind,
  size,
  ingredients: "",
  url: null,
  source: "generic",
});

/** The six invented products, used when no brand names should show. */
export const GENERIC: Product[] = [
  fictional("ff-daily-lotion-30", "Daily Lotion SPF 30", "cream", 30, "50 ml"),
  fictional("ff-noon-fluid-50", "Noon Fluid SPF 50", "fluid", 50, "40 ml"),
  fictional("ff-tint-compact-30", "Tint Compact SPF 30", "cream", 30, "10 g"),
  fictional("ff-veil-mist-30", "Veil Mist SPF 30", "spray", 30, "75 ml"),
  fictional("ff-glide-stick-50", "Glide Stick SPF 50", "stick", 50, "15 g"),
  fictional("ff-dusk-balm", "Dusk Cleansing Balm", "cleanser", null, "100 ml"),
];

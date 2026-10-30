// The store preview's shelves: products grouped by kind, in routine order (morning, midday, evening).
// Pure, so the catalogue page, the nav and the breadcrumb all agree on the same groups.
import type { Kind, Product } from "./products";

export type Shelf = { id: string; title: string; note: string; kinds: Kind[] };

export const SHELVES: Shelf[] = [
  { id: "creams", title: "Creams & fluids", note: "The morning step: daily SPF for face and body.", kinds: ["cream", "fluid"] },
  { id: "sticks-sprays", title: "Sticks & sprays", note: "The midday top-up, over make-up or on the go.", kinds: ["stick", "spray"] },
  { id: "cleansers", title: "Cleansers", note: "The evening step: wash the day's SPF off.", kinds: ["cleanser"] },
];

export const shelfOf = (kind: Kind): Shelf => SHELVES.find((s) => s.kinds.includes(kind)) ?? SHELVES[0];

/** The shelves that have products, each with its products in catalogue order. */
export function shelves(list: Product[]): (Shelf & { products: Product[] })[] {
  return SHELVES.map((s) => ({ ...s, products: list.filter((p) => s.kinds.includes(p.kind)) })).filter((s) => s.products.length);
}

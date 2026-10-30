// Server only: reads fixtures/products.json. FF_CATALOGUE=generic swaps in the fictional set (no brand names).
import { readFileSync } from "node:fs";
import path from "node:path";
import { GENERIC, type Product } from "./products";

export function loadCatalogue(): Product[] {
  if (process.env.FF_CATALOGUE === "generic") return GENERIC;
  const file = path.join(process.cwd(), "fixtures", "products.json");
  return JSON.parse(readFileSync(file, "utf8")).products;
}

export function findProduct(code: string): Product | null {
  return loadCatalogue().find((p) => p.code === code) ?? null;
}

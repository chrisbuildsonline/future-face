import { describe, expect, test } from "bun:test";
import { findBannedWords } from "./banned";
import { loadCatalogue } from "./catalogue";
import { GENERIC, type Product } from "./products";
import { SHELVES, shelfOf, shelves } from "./shelves";

describe("shelves", () => {
  for (const [name, list] of [
    ["fixtures", loadCatalogue()],
    ["generic", GENERIC],
  ] as const)
    test(`${name}: every product on exactly one shelf, catalogue order kept, no empty shelf`, () => {
      const out = shelves(list);
      expect(out.flatMap((s) => s.products).length).toBe(list.length);
      for (const p of list) expect(out.filter((s) => s.products.includes(p))).toHaveLength(1);
      for (const s of out) {
        expect(s.products.length).toBeGreaterThan(0);
        expect(s.products).toEqual(list.filter((p) => s.kinds.includes(p.kind)));
      }
      expect(out.map((s) => s.id)).toEqual(SHELVES.map((s) => s.id).filter((id) => out.some((s) => s.id === id)));
    });

  test("the fixtures fill sun creams, sticks & sprays, and cleansers", () => {
    expect(shelves(loadCatalogue()).map((s) => s.id)).toEqual(["creams", "sticks-sprays", "cleansers"]);
  });

  test("a shelf with no products is left out (no nav item to an empty group)", () => {
    const creams = loadCatalogue().filter((p: Product) => p.kind === "cream");
    expect(shelves(creams).map((s) => s.id)).toEqual(["creams"]);
  });

  test("shelfOf maps every kind; ids are anchor-safe and unique; copy is clean", () => {
    for (const kind of ["cream", "fluid", "stick", "spray", "cleanser"] as const) expect(shelfOf(kind).kinds).toContain(kind);
    expect(shelfOf("fluid").id).toBe("creams");
    expect(shelfOf("spray").id).toBe("sticks-sprays");
    const ids = SHELVES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z-]+$/);
    expect(findBannedWords(SHELVES)).toEqual([]);
  });
});

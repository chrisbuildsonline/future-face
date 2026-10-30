import { afterEach, describe, expect, test } from "bun:test";
import { findProduct, loadCatalogue } from "./catalogue";
import { GENERIC } from "./products";

const saved = process.env.FF_CATALOGUE;
afterEach(() => {
  if (saved === undefined) delete process.env.FF_CATALOGUE;
  else process.env.FF_CATALOGUE = saved;
});

describe("loadCatalogue", () => {
  test("reads fixtures/products.json by default", () => {
    delete process.env.FF_CATALOGUE;
    const c = loadCatalogue();
    expect(c.length).toBeGreaterThanOrEqual(12);
    expect(c.every((p) => p.source === "obf")).toBe(true);
  });

  test("FF_CATALOGUE=generic returns the fictional six", () => {
    process.env.FF_CATALOGUE = "generic";
    expect(loadCatalogue()).toEqual(GENERIC);
  });

  test("any other value reads the fixture", () => {
    process.env.FF_CATALOGUE = "real";
    expect(loadCatalogue()[0].source).toBe("obf");
  });
});

describe("findProduct", () => {
  test("finds by code and returns null otherwise", () => {
    delete process.env.FF_CATALOGUE;
    const first = loadCatalogue()[0];
    expect(findProduct(first.code)).toEqual(first);
    expect(findProduct("nope")).toBeNull();
    expect(findProduct("")).toBeNull();
  });

  test("follows the generic switch", () => {
    process.env.FF_CATALOGUE = "generic";
    expect(findProduct(GENERIC[0].code)).toEqual(GENERIC[0]);
  });
});

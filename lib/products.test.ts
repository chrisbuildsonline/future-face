import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { findBannedWords } from "./banned";
import { GENERIC, isCode, kindOf, mapObf, parseSpf, productLabel, type Product } from "./products";

const ROOT = resolve(import.meta.dir + "/..");
const sample: Record<string, unknown>[] = JSON.parse(readFileSync(join(ROOT, "fixtures/obf-sample.json"), "utf8"));
const byCode = (code: string) => sample.find((r) => r.code === code)!;

describe("parseSpf", () => {
  const cases: [string, number | null][] = [
    ["SPF 50", 50],
    ["SPF50+", 50],
    ["spf 30", 30],
    ["SPF30", 30],
    ["FPS 50", 50],
    ["LSF 30", 30],
    ["IP 50", 50],
    ["Daily Fluid 50+SPF", 50],
    ["Sun Cream SPF 50+ PA++++", 50],
    ["Sensitive Immediate Protect, SPF30", 30],
    ["SPF 15", 15],
    ["UPF 50", null],
    ["UPF 50+ shirt", null],
    ["SPF 0", null],
    ["SPF 1", null],
    ["SPF 150", null],
    ["Sunscreen", null],
    ["", null],
  ];
  for (const [text, want] of cases)
    test(`${JSON.stringify(text)} -> ${want}`, () => {
      expect(parseSpf(text)).toBe(want);
    });
});

describe("isCode", () => {
  test("8 to 14 digits only", () => {
    for (const ok of ["12345678", "3337875917872", "00000000000000"]) expect(isCode(ok)).toBe(true);
    for (const bad of ["1234567", "123456789012345", "12345abc", "", "../etc/passwd", "1234 5678"]) expect(isCode(bad)).toBe(false);
  });
});

describe("kindOf", () => {
  test("picks the kind from name and categories", () => {
    expect(kindOf("Mineral Sunscreen Stick SPF 50", [])).toBe("stick");
    expect(kindOf("Sunscreen Spray SPF 50", ["en:sunscreen"])).toBe("spray");
    expect(kindOf("Invisible UV Fluid SPF 50", [])).toBe("fluid");
    expect(kindOf("Sun Cream SPF 50", [])).toBe("cream");
    expect(kindOf("Lotion SPF 30", [])).toBe("cream");
    expect(kindOf("Foaming Facial Cleanser", ["en:face", "en:cleansers"])).toBe("cleanser");
    expect(kindOf("Gentle gel", ["en:cleansers"])).toBe("cleanser");
    expect(kindOf("Micellar water", [])).toBe("cleanser");
  });
});

describe("mapObf against the recorded sample", () => {
  const accepted: [string, number | null, string, string | null][] = [
    ["0840155604698", 50, "spray", "Sun Bum"],
    ["0871760000445", 30, "cream", "Sun Bum"],
    ["0075486091125", 30, "spray", "Hawaiian Tropic"],
    ["3606000612655", 50, "cream", "Cerave"],
    ["4005900602114", 30, "cream", "Nivea"],
    ["4006000174686", 50, "fluid", "Nivea"],
    ["8906171510039", 50, "cream", "Hyphen"],
    ["3606000537750", null, "cleanser", "CeraVe"],
    ["3401395376935", null, "cleanser", "Bioderma"],
  ];
  for (const [code, spf, kind, brand] of accepted)
    test(`accepts ${code}`, () => {
      const p = mapObf(byCode(code))!;
      expect(p).not.toBeNull();
      expect(p.code).toBe(code);
      expect(p.spf).toBe(spf);
      expect(p.kind).toBe(kind as Product["kind"]);
      expect(p.brand).toBe(brand);
      expect(p.source).toBe("obf");
      expect(p.image).toBe(`/products/${code}.jpg`);
      expect(p.url).toBe(`https://world.openbeautyfacts.org/product/${code}`);
      expect(p.name).toBe(p.name.trim());
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.ingredients.length).toBeGreaterThan(0);
    });

  const rejected: [string, string][] = [
    ["3337875917872", "no SPF in the name"],
    ["0810069220604", "no front image"],
    ["4005900370525", "SPF 20 is under 30"],
    ["3337875945738", "no ingredients"],
    ["3606000642669", "no name"],
    ["0086800078487", "no SPF in the name"],
    ["0072140036096", "no front image"],
  ];
  for (const [code, why] of rejected)
    test(`rejects ${code} (${why})`, () => {
      expect(mapObf(byCode(code))).toBeNull();
    });

  test("takes the first brand and trims the name and size", () => {
    const p = mapObf({
      code: "4005900602114",
      product_name: "  Sun Lotion SPF 30  ",
      brands: " Nivea , Nivea Sun",
      image_front_url: "https://example.org/a.jpg",
      ingredients_text: " AQUA, GLYCERIN ",
      quantity: " 200 ml ",
      categories_tags: ["en:sunscreen"],
    })!;
    expect(p.name).toBe("Sun Lotion SPF 30");
    expect(p.brand).toBe("Nivea");
    expect(p.ingredients).toBe("AQUA, GLYCERIN");
    expect(p.size).toBe("200 ml");
  });

  test("rejects a bad code, junk input and a missing brand is fine", () => {
    const base = { product_name: "Cream SPF 50", image_front_url: "https://example.org/a.jpg", ingredients_text: "AQUA" };
    expect(mapObf({ ...base, code: "abc" })).toBeNull();
    expect(mapObf({ ...base, code: "12345678" })!.brand).toBeNull();
    expect(mapObf(null)).toBeNull();
    expect(mapObf("x")).toBeNull();
    expect(mapObf({})).toBeNull();
  });
});

describe("productLabel", () => {
  const cases: [string | null, string, string][] = [
    ["Bondi sands", "Zinc Mineral SPF 50+", "Bondi sands Zinc Mineral SPF 50+"],
    [null, "Daily Lotion SPF 30", "Daily Lotion SPF 30"],
    // Open Beauty Facts names that already start with the brand: the brand once, never twice
    ["Daylong", "Daylong Sensitive Face Mineral Cream SPF 50", "Daylong Sensitive Face Mineral Cream SPF 50"],
    ["Skinceuticals", "SkinCeuticals Advanced Brightening UV Defense Sunscreen SPF 50", "SkinCeuticals Advanced Brightening UV Defense Sunscreen SPF 50"],
    ["Dr.Melaxin", "Dr.Melaxin Hydro Ceramic Serum", "Dr.Melaxin Hydro Ceramic Serum"],
    ["  Daylong ", "daylong Face Cream SPF 50", "daylong Face Cream SPF 50"],
    // a brand that is only the start of the first word is not "already there"
    ["Sun", "Sunscreen Lotion SPF 30", "Sun Sunscreen Lotion SPF 30"],
    ["Daylong", "Daylong", "Daylong"],
  ];
  for (const [brand, name, want] of cases)
    test(`${JSON.stringify(brand)} + ${JSON.stringify(name)}`, () => {
      expect(productLabel({ brand, name })).toBe(want);
    });

  test("no product in the fixture repeats its brand in its label", () => {
    const products: Product[] = JSON.parse(readFileSync(join(ROOT, "fixtures/products.json"), "utf8")).products;
    for (const p of products) {
      if (!p.brand) continue;
      const label = productLabel(p).toLowerCase();
      const b = p.brand.toLowerCase();
      expect(label.indexOf(b, label.indexOf(b) + b.length)).toBe(-1);
    }
  });
});

describe("GENERIC", () => {
  test("the six fictional products", () => {
    expect(GENERIC).toHaveLength(6);
    for (const p of GENERIC) {
      expect(p.source).toBe("generic");
      expect(p.image).toBeNull();
      expect(p.url).toBeNull();
      expect(p.code).toMatch(/^ff-[a-z0-9]+(-[a-z0-9]+)*$/);
    }
    expect(GENERIC.filter((p) => p.kind === "cleanser")).toHaveLength(1);
    expect(GENERIC.filter((p) => p.kind === "cleanser")[0].spf).toBeNull();
    expect(findBannedWords(GENERIC)).toEqual([]);
  });
});

describe("fixtures/products.json", () => {
  const file = JSON.parse(readFileSync(join(ROOT, "fixtures/products.json"), "utf8"));
  const products: Product[] = file.products;

  test("header", () => {
    expect(file.source).toBe("Open Beauty Facts");
    expect(file.license).toBe("Data ODbL 1.0, images CC BY-SA 3.0");
    expect(Number.isNaN(Date.parse(file.fetchedAt))).toBe(false);
  });

  test("12 to 16 products with valid codes, no duplicates, sorted by code", () => {
    expect(products.length).toBeGreaterThanOrEqual(12);
    expect(products.length).toBeLessThanOrEqual(16);
    for (const p of products) expect(isCode(p.code)).toBe(true);
    const codes = products.map((p) => p.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toEqual([...codes].sort());
  });

  test("every product is a full obf record with an image on disk", () => {
    for (const p of products) {
      expect(p.source).toBe("obf");
      expect(p.image).toBe(`/products/${p.code}.jpg`);
      expect(existsSync(join(ROOT, "public", p.image!))).toBe(true);
      expect(p.url).toBe(`https://world.openbeautyfacts.org/product/${p.code}`);
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.ingredients.length).toBeGreaterThan(0);
      if (p.kind === "cleanser") expect(p.spf).toBeNull();
      else expect(p.spf).toBeGreaterThanOrEqual(30);
    }
  });

  test("has the mix the routine needs", () => {
    const sun = products.filter((p) => p.kind !== "cleanser");
    const body = (p: Product) => p.kind === "cream" || p.kind === "fluid";
    const hold = (p: Product) => p.kind === "stick" || p.kind === "spray";
    expect(sun.filter((p) => body(p) && p.spf! >= 50).length).toBeGreaterThanOrEqual(3);
    expect(sun.filter((p) => body(p) && p.spf! >= 30 && p.spf! < 50).length).toBeGreaterThanOrEqual(2);
    expect(sun.filter(hold).length).toBeGreaterThanOrEqual(2);
    expect(sun.filter((p) => hold(p) && p.spf! >= 50).length).toBeGreaterThanOrEqual(1);
    expect(products.filter((p) => p.kind === "cleanser").length).toBeGreaterThanOrEqual(2);
  });
});

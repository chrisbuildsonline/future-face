import { describe, expect, test } from "bun:test";
import * as copy from "./copy";
import { findBannedWords } from "./banned";

describe("findBannedWords", () => {
  test("finds banned stems in nested objects and arrays, case-insensitive", () => {
    const sample = {
      a: "Fine words",
      b: { c: ["no problem", "Lower RISK of trouble"] },
      d: [{ e: "a Treatment plan" }],
    };
    expect(findBannedWords(sample).sort()).toEqual(["risk", "treatment"]);
  });

  test("flags every stem: damage, risk, cancer, diagnos, prognos, cure, treat, disease", () => {
    const words = [
      "sun damage",
      "risky",
      "cancer",
      "a diagnosis",
      "we diagnose",
      "prognosis",
      "a cure",
      "treat it",
      "skin disease",
    ];
    expect(findBannedWords(words)).toHaveLength(words.length);
  });

  test("allows exactly the disclaimer phrase 'not a prognosis'", () => {
    expect(findBannedWords("An illustrative projection, not a prognosis.")).toEqual([]);
    expect(findBannedWords("Not a prognosis")).toEqual([]);
    expect(findBannedWords("Your prognosis")).toEqual(["prognosis"]);
    expect(findBannedWords("not a prognosis, a prognosis")).toEqual(["prognosis"]);
  });

  test("does not flag words that merely contain a stem mid-word", () => {
    expect(findBannedWords(["secure checkout", "accurate", "curated", "manicure"])).toEqual([]);
  });
});

describe("lib/copy", () => {
  test("exports the landing copy the page needs", () => {
    expect(copy.landing.hero.title.length).toBeGreaterThan(0);
    expect(copy.landing.hero.cta.length).toBeGreaterThan(0);
    expect(copy.landing.how.steps.map((s) => s.api)).toEqual([
      "AI Aging Generator",
      "AI Skin Simulation",
      "AI Skin Analysis",
    ]);
    expect(copy.landing.how.citation.text).toContain("Ann Intern Med");
  });

  test("states the renders are an illustrative projection, not a prognosis", () => {
    expect(JSON.stringify(copy).toLowerCase()).toContain("not a prognosis");
  });

  test("exports the routine copy, and it is clean", () => {
    expect(copy.routine.cta).toBe("Build my SPF routine");
    expect(copy.routine.listTitle).toBe("Your routine");
    expect(JSON.stringify(copy.routine)).not.toMatch(/€|checkout|subtotal|price/i);
    expect(findBannedWords(copy.routine)).toEqual([]);
  });

  test("a photo with no face says so plainly, apart from the face-too-small copy", () => {
    expect(copy.upload.noFace).toBe("We couldn't find a face in that photo");
    expect(copy.upload.noFaceHint.length).toBeGreaterThan(0);
    expect(`${copy.upload.noFace} ${copy.upload.noFaceHint}`).not.toMatch(/small/i);
    expect(copy.errors.face_too_small).toMatch(/small/i);
  });

  test("the 404 page has a title, a line and both ways back", () => {
    expect(copy.notFound.title.length).toBeGreaterThan(0);
    expect(copy.notFound.lead.length).toBeGreaterThan(0);
    expect(copy.notFound.demo.length).toBeGreaterThan(0);
    expect(copy.notFound.store.length).toBeGreaterThan(0);
  });

  test("contains none of the banned words in any exported string", () => {
    expect(findBannedWords(copy)).toEqual([]);
  });
});

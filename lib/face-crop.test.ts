import { describe, expect, test } from "bun:test";
import { faceCropRect } from "./face-crop";

describe("faceCropRect", () => {
  test("centred 1400px face in 4000x3000 gives a 2333 square around it", () => {
    const r = faceCropRect({ width: 4000, height: 3000 }, { x: 1300, y: 900, width: 1400, height: 1400 })!;
    expect(r.size).toBe(2333); // 1400 / 0.6; the height term gives only 1960
    expect(r.x).toBe(834); // centre 2000.5, on the face centre (2000)
    // centre sits ~10% of face height above the face centre (1600 - 140 = 1460)
    expect(r.y).toBe(294); // centre 1460.5
  });

  test("a face near a corner is clamped inside the image", () => {
    const r = faceCropRect({ width: 4000, height: 3000 }, { x: 20, y: 10, width: 700, height: 700 })!;
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
    expect(r.size).toBe(1167);
  });

  test("a tiny face grows the crop to minSize", () => {
    const r = faceCropRect({ width: 4000, height: 3000 }, { x: 1900, y: 1400, width: 100, height: 100 })!;
    expect(r.size).toBe(480);
  });

  test("minSize growth is capped by the short side", () => {
    const r = faceCropRect({ width: 4000, height: 500 }, { x: 1900, y: 100, width: 600, height: 600 })!;
    expect(r.size).toBe(500); // wants 1000, only 500 fits
  });

  test("a face already filling 60% of the width returns null", () => {
    expect(faceCropRect({ width: 2000, height: 2000 }, { x: 350, y: 400, width: 1200, height: 1200 })).toBeNull();
    expect(faceCropRect({ width: 2000, height: 2000 }, { x: 350, y: 400, width: 1199, height: 1199 })).not.toBeNull();
  });

  test("an image with a short side under minSize returns null", () => {
    expect(faceCropRect({ width: 400, height: 400 }, { x: 100, y: 100, width: 100, height: 100 })).toBeNull();
    expect(faceCropRect({ width: 4000, height: 400 }, { x: 100, y: 100, width: 100, height: 100 })).toBeNull();
  });

  test("a tall face box keeps forehead and chin inside the square", () => {
    const r = faceCropRect({ width: 1600, height: 1200 }, { x: 650, y: 300, width: 300, height: 400 })!;
    expect(r.size).toBeGreaterThanOrEqual(500);
    expect(r.y).toBeLessThanOrEqual(300 - 40);
    expect(r.y + r.size).toBeGreaterThanOrEqual(700 + 40);
  });

  test("the wide fixture's BlazeFace box gets head room: a square of at least 981 with a 10% margin", () => {
    const face = { x: 430, y: 520, width: 589, height: 620 };
    const r = faceCropRect({ width: 2400, height: 1600 }, face)!;
    expect(r.size).toBeGreaterThanOrEqual(981);
    expect(r.x).toBeLessThanOrEqual(face.x - face.width * 0.1);
    expect(r.y).toBeLessThanOrEqual(face.y - face.height * 0.1);
    expect(r.x + r.size).toBeGreaterThanOrEqual(face.x + face.width * 1.1);
    expect(r.y + r.size).toBeGreaterThanOrEqual(face.y + face.height * 1.1);
  });

  test("random cases: integers, inside bounds, face stays inside the square when it fits", () => {
    let seed = 12345;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    for (let i = 0; i < 500; i++) {
      const img = { width: 500 + Math.floor(rnd() * 4000), height: 500 + Math.floor(rnd() * 4000) };
      const fw = 20 + Math.floor(rnd() * Math.min(img.width, img.height) * 0.6);
      const fh = Math.round(fw * (1 + rnd() * 0.4));
      const face = {
        x: Math.floor(rnd() * (img.width - fw)),
        y: Math.floor(rnd() * (img.height - fh)),
        width: fw,
        height: fh,
      };
      const r = faceCropRect(img, face);
      if (!r) continue;
      if (1.2 * fh <= Math.min(img.width, img.height)) {
        expect(r.x).toBeLessThanOrEqual(face.x);
        expect(r.y).toBeLessThanOrEqual(face.y);
        expect(r.x + r.size).toBeGreaterThanOrEqual(face.x + fw);
        expect(r.y + r.size).toBeGreaterThanOrEqual(face.y + fh);
      }
      for (const n of [r.x, r.y, r.size]) expect(Number.isInteger(n)).toBe(true);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.size).toBeLessThanOrEqual(img.width);
      expect(r.y + r.size).toBeLessThanOrEqual(img.height);
      expect(r.size).toBeGreaterThanOrEqual(480);
    }
  });
});

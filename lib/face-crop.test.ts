import { describe, expect, test } from "bun:test";
import { faceCropRect } from "./face-crop";

describe("faceCropRect", () => {
  test("centred 1400px face in 4000x3000 gives a 2000 square around it", () => {
    const r = faceCropRect({ width: 4000, height: 3000 }, { x: 1300, y: 900, width: 1400, height: 1400 })!;
    expect(r.size).toBe(2000);
    expect(r.x + r.size / 2).toBe(2000); // centred horizontally on the face
    // centre sits ~10% of face height above the face centre (1600 - 140)
    expect(r.y + r.size / 2).toBe(1460);
  });

  test("a face near a corner is clamped inside the image", () => {
    const r = faceCropRect({ width: 4000, height: 3000 }, { x: 20, y: 10, width: 700, height: 700 })!;
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
    expect(r.size).toBe(1000);
  });

  test("a tiny face grows the crop to minSize", () => {
    const r = faceCropRect({ width: 4000, height: 3000 }, { x: 1900, y: 1400, width: 100, height: 100 })!;
    expect(r.size).toBe(480);
  });

  test("minSize growth is capped by the short side", () => {
    const r = faceCropRect({ width: 4000, height: 500 }, { x: 1900, y: 100, width: 600, height: 600 })!;
    expect(r.size).toBe(500); // wants 857, only 500 fits
  });

  test("a face already filling 75% of the width returns null", () => {
    expect(faceCropRect({ width: 2000, height: 2000 }, { x: 250, y: 400, width: 1500, height: 1500 })).toBeNull();
  });

  test("an image with a short side under minSize returns null", () => {
    expect(faceCropRect({ width: 400, height: 400 }, { x: 100, y: 100, width: 100, height: 100 })).toBeNull();
    expect(faceCropRect({ width: 4000, height: 400 }, { x: 100, y: 100, width: 100, height: 100 })).toBeNull();
  });

  test("random cases: integers, inside bounds, face stays inside the square when it fits", () => {
    let seed = 12345;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    for (let i = 0; i < 500; i++) {
      const img = { width: 500 + Math.floor(rnd() * 4000), height: 500 + Math.floor(rnd() * 4000) };
      const fw = 20 + Math.floor(rnd() * Math.min(img.width, img.height) * 0.6);
      const face = {
        x: Math.floor(rnd() * (img.width - fw)),
        y: Math.floor(rnd() * (img.height - fw)),
        width: fw,
        height: fw,
      };
      const r = faceCropRect(img, face);
      if (!r) continue;
      for (const n of [r.x, r.y, r.size]) expect(Number.isInteger(n)).toBe(true);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.size).toBeLessThanOrEqual(img.width);
      expect(r.y + r.size).toBeLessThanOrEqual(img.height);
      expect(r.size).toBeGreaterThanOrEqual(480);
    }
  });
});

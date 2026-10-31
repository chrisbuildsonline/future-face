import { expect, test } from "@playwright/test";

test("GET /api/future returns the demo result and its images are served", async ({ request }) => {
  const res = await request.get("/api/future");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.horizons.map((h: { years: number }) => h.years)).toEqual([20, 30]);

  // no city: the recorded Nambour reading against itself (UV ratio 1), times face a's measured brown tone (0.5): 0.12
  expect(body.dose).toMatchObject({ cityName: "Nambour", referenceCity: "Nambour", uvRatio: 1, ratio: 0.5, intensity: 0.12 });
  expect(body.dose.tone).toMatchObject({ band: "brown", factor: 0.5 });
  expect(body.settings).toEqual({ spots: 0.12, wrinkle: 0.12, texture: 0.12 });

  for (const h of body.horizons) {
    // both arms share one aging frame; the SPF arm is that frame through Skin Simulation at the dose
    expect(h).not.toHaveProperty("spfResAge");
    expect(h.spf.image).toMatch(new RegExp(`spf-${h.years}-012\\.jpg$`));
    expect(h.spf.image).not.toBe(h.now.image);
    expect(h.measured.length).toBeGreaterThan(0);
  }

  for (const src of [body.horizons[0].now.image, body.horizons[0].spf.image]) {
    const img = await request.get(src);
    expect(img.status()).toBe(200);
    expect(img.headers()["content-type"]).toBe("image/jpeg");
  }
});

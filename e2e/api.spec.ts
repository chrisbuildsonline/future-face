import { expect, test } from "@playwright/test";

test("GET /api/future returns the demo result and its images are served", async ({ request }) => {
  const res = await request.get("/api/future");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.horizons.map((h: { years: number }) => h.years)).toEqual([20, 30]);

  // no city: the recorded Nambour reading against itself, so the trial's own 0.24
  expect(body.dose).toMatchObject({ cityName: "Nambour", referenceCity: "Nambour", ratio: 1, intensity: 0.24 });
  expect(body.settings).toEqual({ spots: 0.24, wrinkle: 0.24, texture: 0.24 });

  for (const h of body.horizons) {
    // both arms share one aging frame; the SPF arm is that frame through Skin Simulation at the dose
    expect(h).not.toHaveProperty("spfResAge");
    expect(h.spf.image).toMatch(new RegExp(`spf-${h.years}-024\\.jpg$`));
    expect(h.spf.image).not.toBe(h.now.image);
    expect(h.measured.length).toBeGreaterThan(0);
  }

  for (const src of [body.horizons[0].now.image, body.horizons[0].spf.image]) {
    const img = await request.get(src);
    expect(img.status()).toBe(200);
    expect(img.headers()["content-type"]).toBe("image/jpeg");
  }
});

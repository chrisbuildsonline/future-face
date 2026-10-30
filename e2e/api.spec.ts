import { expect, test } from "@playwright/test";

test("GET /api/future returns the demo result and its images are served", async ({ request }) => {
  const res = await request.get("/api/future");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.horizons.map((h: { years: number }) => h.years)).toEqual([20, 30]);

  for (const h of body.horizons) {
    // the SPF arm is an earlier aging frame, so the two faces are different images
    expect(h.spfResAge).toBeLessThan(h.resAge);
    expect(h.spf.image).not.toBe(h.now.image);
    expect(h.measured.length).toBeGreaterThan(0);
  }

  const img = await request.get(body.horizons[0].now.image);
  expect(img.status()).toBe(200);
  expect(img.headers()["content-type"]).toBe("image/jpeg");
});

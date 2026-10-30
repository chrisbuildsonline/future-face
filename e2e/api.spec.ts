import { expect, test } from "@playwright/test";

test("GET /api/future returns the demo result and its images are served", async ({ request }) => {
  const res = await request.get("/api/future");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.horizons).toHaveLength(2);

  const img = await request.get(body.horizons[0].now.image);
  expect(img.status()).toBe(200);
  expect(img.headers()["content-type"]).toBe("image/jpeg");
});

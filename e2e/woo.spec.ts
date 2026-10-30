import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const STORE = "http://localhost:8080";

test.beforeAll(async () => {
  const up = await fetch(STORE).then(
    (r) => r.status < 500,
    () => false,
  );
  test.skip(!up, "store not running: bun run store");
});

test("a seeded SPF 50 product page embeds the Future Face widget", async ({ page, request }) => {
  const { products } = JSON.parse(readFileSync("fixtures/products.json", "utf8")) as {
    products: { code: string; spf: number | null }[];
  };
  const spf50 = products.find((p) => p.spf === 50);
  expect(spf50, "fixtures/products.json has an SPF 50 product").toBeTruthy();

  const res = await request.get(`${STORE}/wp-json/wc/store/v1/products?sku=${spf50!.code}`);
  expect(res.status()).toBe(200);
  const [found] = await res.json();
  expect(found.permalink).toContain(STORE);

  // Demo prices are per kind of product: no SPF 50 product costs the old flat 9.90.
  expect(found.prices.price).not.toBe("990");

  await page.goto(found.permalink);

  await expect(page.getByText("Sun care for every UV day").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Sun care" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /^Sample/ })).toHaveCount(0);
  await expect(page.getByText("Hello world!")).toHaveCount(0);

  const widget = page.locator("div[data-future-face]");
  await expect(widget).toHaveCount(1);
  await expect(widget).toHaveAttribute("data-product", /^\d{8,14}$/);
  await expect(widget).toHaveAttribute("data-spf", "50");
  await expect(page.locator('script[src$="/widget.js"]')).toHaveCount(1);
});

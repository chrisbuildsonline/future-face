import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { notFound } from "../lib/copy";

mkdirSync("docs/screenshots", { recursive: true });

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 },
] as const;

test("an unknown URL answers 404", async ({ request }) => {
  const res = await request.get("/nope");
  expect(res.status()).toBe(404);
});

for (const vp of viewports) {
  test.describe(`404 at ${vp.width}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("is the branded page, with the demo result and the store one click away", async ({ page }) => {
      const res = await page.goto("/nope");
      expect(res?.status()).toBe(404);

      const title = page.getByRole("heading", { level: 1 });
      await expect(title).toHaveText(notFound.title);
      expect(await title.evaluate((el) => getComputedStyle(el).fontFamily)).toContain("Instrument Serif");
      expect(await page.locator("body").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(241, 238, 234)");
      await expect(page.getByText(notFound.lead)).toBeVisible();

      const demo = page.locator("main").getByRole("link", { name: notFound.demo });
      const store = page.locator("main").getByRole("link", { name: notFound.store });
      await expect(demo).toHaveAttribute("href", "/result");
      await expect(store).toHaveAttribute("href", "/store");
      await expect(demo).toBeInViewport();
      await expect(store).toBeInViewport();

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBe(0);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `docs/screenshots/not-found-${vp.name}.png`, animations: "disabled" });

      await demo.click();
      await expect(page).toHaveURL(/\/result$/);
      await expect(page.getByTestId("face-spf")).toBeVisible();
    });
  });
}

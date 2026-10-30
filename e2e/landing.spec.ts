import { expect, test, type Page } from "@playwright/test";
import { landing } from "../lib/copy";

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 },
] as const;

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

for (const vp of viewports) {
  test.describe(`landing at ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("shows the title and primary action, and the action opens the demo result", async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto("/");

      const title = page.getByRole("heading", { level: 1 });
      await expect(title).toBeVisible();
      await expect(title).toHaveText(landing.hero.title);

      const cta = page.getByRole("link", { name: landing.hero.cta });
      await expect(cta).toBeVisible();
      await expect(cta).toBeInViewport();

      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `test-results/landing-${vp.name}.png`,
        fullPage: true,
        animations: "disabled",
      });

      // The phone layout must be built for 390px, not a desktop page that overflows sideways.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);

      await cta.click();
      await expect(page).toHaveURL(/\/result$/);
      await expect(page.getByTestId("face-spf")).toBeVisible();

      expect(errors).toEqual([]);
    });
  });
}

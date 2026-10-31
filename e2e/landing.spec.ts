import { mkdirSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { landing, result as resultCopy } from "../lib/copy";

mkdirSync("docs/screenshots", { recursive: true });

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

async function expectLoaded(img: Locator) {
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
}

const clipOf = (img: Locator) => img.evaluate((el) => getComputedStyle(el).clipPath);

const intersects = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

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

    test("the hero is the real two-face comparison of the demo face, with a working slider", async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto("/");

      const hero = page.getByTestId("hero-compare");
      await expect(hero).toBeVisible();
      const now = hero.getByTestId("hero-now");
      const spf = hero.getByTestId("hero-spf");
      await expectLoaded(now);
      await expectLoaded(spf);
      // +30 yrs is the default horizon; the SPF face at the demo's own dose (0.12: Nambour's UV x face a's brown tone, 0.5)
      await expect(now).toHaveAttribute("src", /now-30\.jpg/);
      await expect(spf).toHaveAttribute("src", /spf-30-012\.jpg/);
      await expect(hero.getByText(resultCopy.slider.left, { exact: true })).toBeVisible();
      await expect(hero.getByText(resultCopy.slider.right, { exact: true })).toBeVisible();

      // the abstract sphere is gone
      await expect(page.getByRole("img", { name: "Illustration of the two-future slider" })).toHaveCount(0);

      // keyboard: End shows all of "as you live now", Home all of "with daily SPF"
      const slider = hero.getByRole("slider", { name: resultCopy.slider.label });
      await slider.focus();
      await page.keyboard.press("End");
      await expect(slider).toHaveValue("100");
      await expect.poll(() => clipOf(spf)).toContain("100%");
      await page.keyboard.press("Home");
      await expect(slider).toHaveValue("0");
      await slider.fill("50");
      await expect(slider).toHaveValue("50");

      // one primary action, and on a phone it never sits on the faces at first view
      const cta = page.getByRole("link", { name: landing.hero.cta });
      await expect(cta).toHaveCount(1);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
      await expect(cta).toBeInViewport();
      const frame = (await slider.boundingBox())!;
      const pill = (await cta.boundingBox())!;
      expect(intersects(frame, pill)).toBe(false);

      await slider.blur();
      await page.screenshot({ path: `docs/screenshots/landing-${vp.name}.png`, animations: "disabled" });
      expect(errors).toEqual([]);
    });
  });
}

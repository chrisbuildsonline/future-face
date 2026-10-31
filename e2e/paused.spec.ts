import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { errors as errorCopy, result as copy, upload } from "../lib/copy";

// F19: when YouCam is out of units, POST /api/future answers 200 with the demo result, `paused: true` and the
// insufficient_units notice. Every POST here is stubbed: nothing reaches YouCam.

mkdirSync("docs/screenshots", { recursive: true });

function collectErrors(page: Page, ignore: RegExp[] = []) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && !ignore.some((re) => re.test(msg.text()))) errors.push(`console: ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

async function fillAndSubmit(page: Page) {
  await page.goto("/");
  await page.getByLabel(upload.file).setInputFiles("e2e/fixtures/wide-selfie.jpg");
  await expect(page.locator("main").getByRole("status").first()).toHaveText(upload.cropDone, { timeout: 20_000 });
  await page.getByLabel(upload.city).fill("Lisbon");
  await page.getByRole("button", { name: upload.submit }).click();
}

const viewports = [
  { name: "1440", width: 1440, height: 900 },
  { name: "390", width: 390, height: 844 },
] as const;

for (const vp of viewports) {
  test.describe(`out of units at ${vp.width}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("a paused run shows the demo face, a 'Live renders paused' pill and one honest line", async ({ page, request }) => {
      const errors = collectErrors(page);
      const demo = await (await request.get("/api/future?city=Lisbon")).json();
      const notice = errorCopy.insufficient_units;
      await page.route("**/api/future", (route) =>
        route.request().method() === "POST"
          ? route.fulfill({ json: { ...demo, paused: true, notice } })
          : route.continue(),
      );
      await fillAndSubmit(page);

      const result = page.getByTestId("upload-result");
      await expect(result).toBeVisible();
      const head = result.locator("header").first();
      await expect(head.getByText(copy.eyebrow.demo, { exact: true })).toBeVisible(); // still says it is the demo face
      const pill = head.getByText(copy.eyebrow.paused, { exact: true });
      await expect(pill).toBeVisible();
      await expect(result.getByRole("status").filter({ hasText: notice })).toBeVisible();
      expect(notice).toMatch(/demo face/i);
      expect(notice).not.toMatch(/\.\s+\S/); // one sentence

      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
      // the result header with a little canvas above it (the submit scrolls it flush to the top)
      // (instant: the page scrolls smoothly, and a shot taken mid-animation lands anywhere)
      // re-aim until the header stays put (late layout or a running scroll can still move it)
      await expect
        .poll(() =>
          head.evaluate(async (el) => {
            window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 32, behavior: "instant" });
            await new Promise((r) => setTimeout(r, 300));
            return Math.round(el.getBoundingClientRect().top);
          }),
        )
        .toBe(32);
      await page.screenshot({ path: `docs/screenshots/paused-${vp.name}.png`, animations: "disabled" });
      expect(errors).toEqual([]);
    });

    test("a failed submit focuses the error, scrolls it into view and links to the demo face", async ({ page }) => {
      // the stubbed 503 itself is logged by the browser; nothing else may be
      const errors = collectErrors(page, [/503/]);
      await page.route("**/api/future", (route) =>
        route.request().method() === "POST"
          ? route.fulfill({ status: 503, json: { error: { kind: "server_busy", message: errorCopy.server_busy } } })
          : route.continue(),
      );
      await fillAndSubmit(page);

      const alert = page.locator("main").getByRole("alert");
      await expect(alert).toContainText(errorCopy.server_busy);
      await expect(alert).toBeFocused();
      await expect(alert).toBeInViewport();
      // let the smooth scroll to centre finish before the shot
      await expect
        .poll(() =>
          alert.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return Math.abs(r.top + r.height / 2 - innerHeight / 2);
          }),
        )
        .toBeLessThan(40);
      await page.screenshot({ path: `test-results/paused-error-${vp.name}.png`, animations: "disabled" });

      const link = alert.getByRole("link", { name: upload.demoLink });
      await expect(link).toHaveAttribute("href", "/result");
      await link.click();
      await expect(page).toHaveURL(/\/result$/);
      await expect(page.getByTestId("face-now")).toBeVisible();
      expect(errors).toEqual([]);
    });
  });
}

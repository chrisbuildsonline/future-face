import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { cityErrors, errors as errorCopy, result as copy, upload } from "../lib/copy";

// F20: accessibility and state gaps from the jury. Every POST here is stubbed: nothing reaches YouCam.

mkdirSync("docs/screenshots", { recursive: true });

const wide = "e2e/fixtures/wide-selfie.jpg";

function collectErrors(page: Page, ignore: RegExp[] = []) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && !ignore.some((re) => re.test(msg.text()))) errors.push(`console: ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

const stubError = (page: Page, status: number, kind: string, message: string) =>
  page.route("**/api/future", (route) =>
    route.request().method() === "POST" ? route.fulfill({ status, json: { error: { kind, message } } }) : route.continue(),
  );

async function fillAndSubmit(page: Page, city: string) {
  await page.goto("/");
  await page.getByLabel(upload.file).setInputFiles(wide);
  await expect(page.locator("main").getByRole("status").first()).toHaveText(upload.cropDone, { timeout: 20_000 });
  await page.getByLabel(upload.city).fill(city);
  const submit = page.getByRole("button", { name: upload.submit });
  await expect(submit).toBeEnabled();
  // under full parallel load a click can land without starting a submit; retry until one starts (the POST is stubbed)
  const started = page
    .getByText(upload.loadingTitle)
    .or(page.getByTestId("upload-result"))
    .or(page.locator("main").getByRole("alert"));
  await expect(async () => {
    await submit.click({ timeout: 3000 });
    await expect(started.first()).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20_000 });
}

test("a city the server can't find marks the city field invalid, described by the error, until it is edited", async ({ page }) => {
  const errors = collectErrors(page, [/400/]);
  await stubError(page, 400, "city_not_found", cityErrors.city_not_found);
  await fillAndSubmit(page, "Atlantis");

  const alert = page.locator("main").getByRole("alert");
  await expect(alert).toContainText(cityErrors.city_not_found);
  const city = page.getByLabel(upload.city);
  await expect(city).toHaveAttribute("aria-invalid", "true");
  await expect(city).toHaveAccessibleDescription(cityErrors.city_not_found);
  const described = page.locator(`[id="${await city.getAttribute("aria-describedby")}"]`);
  await expect(described).toBeVisible();
  await expect(described).toHaveText(cityErrors.city_not_found);

  // editing the city clears it
  await city.fill("Lisbon");
  await expect(city).not.toHaveAttribute("aria-invalid", "true");
  await expect(city).not.toHaveAttribute("aria-describedby");
  await expect(alert).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("an error that is not about the city leaves the city field valid", async ({ page }) => {
  const errors = collectErrors(page, [/503/]);
  await stubError(page, 503, "server_busy", errorCopy.server_busy);
  await fillAndSubmit(page, "Lisbon");
  await expect(page.locator("main").getByRole("alert")).toContainText(errorCopy.server_busy);
  const city = page.getByLabel(upload.city);
  await expect(city).not.toHaveAttribute("aria-invalid", "true");
  await expect(city).not.toHaveAttribute("aria-describedby");
  expect(errors).toEqual([]);
});

const viewports = [
  { name: "1440", width: 1440, height: 900 },
  { name: "390", width: 390, height: 844 },
] as const;

for (const vp of viewports) {
  test.describe(`F20 at ${vp.width}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("the disabled submit says what is missing, in a muted line under it", async ({ page }) => {
      const errors = collectErrors(page);
      await page.route("**/api/future", (route) => (route.request().method() === "POST" ? route.abort() : route.continue()));
      await page.goto("/");
      const card = page.locator("#upload form");
      const submit = card.getByRole("button", { name: upload.submit });
      const city = card.getByLabel(upload.city);

      await expect(submit).toBeDisabled();
      await expect(submit).toHaveAccessibleDescription(upload.needBoth);
      const hint = card.getByText(upload.needBoth, { exact: true });
      await expect(hint).toBeVisible();
      const [b, h] = [(await submit.boundingBox())!, (await hint.boundingBox())!];
      expect(h.y).toBeGreaterThanOrEqual(b.y + b.height);
      expect(await hint.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(107, 101, 94)"); // --ink-2

      await page.evaluate(() => document.fonts.ready);
      await card.evaluate((el) => {
        const r = el.getBoundingClientRect();
        window.scrollTo({ top: r.top + window.scrollY - Math.max(24, (innerHeight - r.height) / 2), behavior: "instant" });
      });
      await page.screenshot({ path: `docs/screenshots/upload-hint-${vp.name}.png`, animations: "disabled" });

      await city.fill("Lisbon");
      await expect(submit).toHaveAccessibleDescription(upload.needSelfie);
      await expect(card.getByText(upload.needSelfie, { exact: true })).toBeVisible();

      await city.fill("");
      await card.getByLabel(upload.file).setInputFiles(wide);
      await expect(card.getByRole("status").first()).toHaveText(upload.cropDone, { timeout: 20_000 });
      await expect(submit).toHaveAccessibleDescription(upload.needCity);
      await expect(card.getByText(upload.needCity, { exact: true })).toBeVisible();

      await city.fill("Lisbon");
      await expect(submit).toBeEnabled();
      await expect(submit).not.toHaveAttribute("aria-describedby");
      for (const t of [upload.needBoth, upload.needSelfie, upload.needCity]) await expect(card.getByText(t, { exact: true })).toHaveCount(0);
      expect(errors).toEqual([]);
    });

    test("the slider's corner tags fade out near their own end", async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto("/result");
      const frame = page.getByTestId("face-now").locator("..");
      const left = frame.getByText(copy.slider.left, { exact: true });
      const right = frame.getByText(copy.slider.right, { exact: true });
      const slider = frame.getByRole("slider", { name: copy.slider.label });

      await slider.focus();
      await page.keyboard.press("Home");
      await expect(slider).toHaveValue("0");
      await expect(left).toHaveAttribute("data-faded", "");
      await expect(left).toHaveCSS("opacity", "0");
      await expect(right).not.toHaveAttribute("data-faded");
      await expect(right).toHaveCSS("opacity", "1");

      await page.keyboard.press("End");
      await expect(slider).toHaveValue("100");
      await expect(right).toHaveAttribute("data-faded", "");
      await expect(right).toHaveCSS("opacity", "0");
      await expect(left).not.toHaveAttribute("data-faded");
      await expect(left).toHaveCSS("opacity", "1");

      // the middle: both tags
      await slider.fill("50");
      await expect(left).toHaveCSS("opacity", "1");
      await expect(right).toHaveCSS("opacity", "1");

      // near the right end: the SPF sliver is narrower than its tag, so only "As you live now" shows
      await slider.fill("92");
      await expect(right).toHaveCSS("opacity", "0");
      await expect(left).toHaveCSS("opacity", "1");
      // the shown tag sits wholly on its own side of the divider
      const [f, l] = [(await frame.boundingBox())!, (await left.boundingBox())!];
      expect(l.x + l.width).toBeLessThan(f.x + f.width * 0.92);

      await slider.blur();
      await page.evaluate(() => document.fonts.ready);
      await frame.evaluate((el) => {
        const r = el.getBoundingClientRect();
        window.scrollTo({ top: r.top + window.scrollY - Math.max(24, (innerHeight - r.height) / 2), behavior: "instant" });
      });
      await page.screenshot({ path: `docs/screenshots/slider-end-${vp.name}.png`, animations: "disabled" });
      expect(errors).toEqual([]);
    });
  });
}

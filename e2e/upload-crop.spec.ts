import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { upload } from "../lib/copy";

// F8: the browser finds the face with MediaPipe and crops the photo to it before upload.
// Nothing here is submitted: any POST to the live API fails the test.

mkdirSync("docs/screenshots", { recursive: true });

const wide = "e2e/fixtures/wide-selfie.jpg"; // 2400x1600, face ~35% of the width, left of centre
// The demo face (fixtures/demo/input.jpg, 1024x1024) has head room around it, so the crop would fire on it.
// A 640px square around that face is a photo where the face already fills the frame.
const FILLED = 640;
const filled = async () => ({
  name: "filled-selfie.jpg",
  mimeType: "image/jpeg",
  buffer: await sharp("fixtures/demo/input.jpg").extract({ left: 192, top: 250, width: FILLED, height: FILLED }).jpeg().toBuffer(),
});

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

async function open(page: Page, errors: string[]) {
  await page.route("**/api/future", (route) => {
    if (route.request().method() !== "POST") return route.continue();
    errors.push("submitted to /api/future");
    return route.abort();
  });
  await page.goto("/");
}

const naturalSize = (page: Page) =>
  page.getByTestId("upload-preview").evaluate(async (el: HTMLImageElement) => {
    await el.decode();
    return { w: el.naturalWidth, h: el.naturalHeight };
  });

const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 },
] as const;

for (const vp of viewports) {
  test.describe(`face crop at ${vp.width}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("a wide selfie is cropped square to the face, and Undo brings the full photo back", async ({ page }) => {
      const errors = collectErrors(page);
      await open(page, errors);
      await page.getByLabel(upload.city).fill("Lisbon");
      await page.getByLabel(upload.file).setInputFiles(wide);

      const status = page.locator("main").getByRole("status");
      const submit = page.getByRole("button", { name: upload.submit });
      await expect(status).toHaveText(upload.cropDone, { timeout: 20_000 });
      await expect(submit).toBeEnabled();

      const crop = await naturalSize(page);
      expect(crop.w).toBe(crop.h);
      expect(crop.w).toBeLessThan(2400);
      await expect(page.getByText("wide-selfie-face.jpg")).toBeVisible();

      // the pill sits on the preview, inside the tile
      const tile = (await page.getByTestId("upload-preview").boundingBox())!;
      const pill = (await status.locator("..").boundingBox())!;
      expect(pill.x).toBeGreaterThanOrEqual(tile.x);
      expect(pill.x + pill.width).toBeLessThanOrEqual(tile.x + tile.width);
      expect(pill.y).toBeGreaterThanOrEqual(tile.y);

      await page.getByLabel(upload.city).blur(); // no focus ring from fill() in the screenshot
      await page.evaluate(() => document.fonts.ready);
      expect(await noOverflow(page)).toBe(0);
      await page.locator("#upload").scrollIntoViewIfNeeded();
      await page.locator("form").screenshot({ path: `docs/screenshots/upload-crop-${vp.name}.png`, animations: "disabled" });

      await page.getByRole("button", { name: upload.cropUndo }).click();
      await expect(status).toHaveText(upload.cropFull);
      await expect.poll(() => naturalSize(page)).toEqual({ w: 2400, h: 1600 });
      await expect(page.getByText("wide-selfie.jpg", { exact: true })).toBeVisible();

      await page.getByRole("button", { name: upload.cropAgain }).click();
      await expect(status).toHaveText(upload.cropDone);
      await expect.poll(async () => (await naturalSize(page)).w).toBe(crop.w);

      expect(errors).toEqual([]);
    });
  });
}

test("a photo where the face already fills the frame is uploaded as is, with no crop pill", async ({ page }) => {
  const errors = collectErrors(page);
  await open(page, errors);
  await page.getByLabel(upload.city).fill("Lisbon");
  await page.getByLabel(upload.file).setInputFiles(await filled());

  // detection finished: the submit pill comes back
  await expect(page.getByRole("button", { name: upload.submit })).toBeEnabled({ timeout: 20_000 });
  await expect(page.getByText(upload.cropDone)).toHaveCount(0);
  await expect(page.getByRole("button", { name: upload.cropUndo })).toHaveCount(0);
  expect(await naturalSize(page)).toEqual({ w: FILLED, h: FILLED });
  await expect(page.getByText("filled-selfie.jpg", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

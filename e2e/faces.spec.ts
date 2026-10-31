import { mkdirSync, readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { landing, result as copy, upload } from "../lib/copy";
import type { FaceId } from "../lib/fixtures";
import { demoResult } from "../lib/pipeline";
import { storeProduct, type Product } from "../lib/products";

// The demo face switch on /result: face a (two horizons) and face b (only +20 recorded, so only +20 offered).

mkdirSync("docs/screenshots", { recursive: true });

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

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const reading = (face: FaceId, years: number) =>
  demoResult(undefined, face)
    .horizons.find((h) => h.years === years)!
    .measured.find((m) => m.key === "wrinkle")!;

const [twentyLabel, thirtyLabel] = landing.visual.horizon;

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 },
] as const;

for (const vp of viewports) {
  test.describe(`demo faces at ${vp.width}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("the face switch swaps renders and readings, and face b offers only the +20 it has", async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto("/result");
      const main = page.locator("main");
      const group = main.getByRole("group", { name: copy.eyebrow.demo });
      const faceA = group.getByRole("link", { name: copy.faces.a });
      const faceB = group.getByRole("link", { name: copy.faces.b });
      const now = page.getByTestId("face-now");
      const spf = page.getByTestId("face-spf");
      const twenty = main.getByRole("button", { name: twentyLabel });
      const thirty = main.getByRole("button", { name: thirtyLabel });

      // face a, +30 by default
      await expect(faceA).toHaveAttribute("aria-current", "true");
      await expect(faceB).not.toHaveAttribute("aria-current", /.+/);
      await expectLoaded(now);
      await expect(now).not.toHaveAttribute("src", /face=b/);
      await expect(thirty).toHaveAttribute("aria-pressed", "true");
      await expect(twenty).toHaveAttribute("aria-pressed", "false");
      await expect(page.getByTestId("horizon-static")).toHaveCount(0);
      await expect(page.getByTestId("measured-wrinkle-now")).toHaveText(reading("a", 30).now.toFixed(1));
      await expect(group.locator("img")).toHaveCount(2);
      for (const img of await group.locator("img").all()) await expectLoaded(img);

      // face b: its own renders and readings, only +20 recorded
      await faceB.click();
      await expect(page).toHaveURL(/[?&]face=b/);
      await expect(faceB).toHaveAttribute("aria-current", "true");
      await expect(faceA).not.toHaveAttribute("aria-current", /.+/);
      await expect(now).toHaveAttribute("src", /face=b/);
      await expect(spf).toHaveAttribute("src", /face=b/);
      await expectLoaded(now);
      await expectLoaded(spf);
      for (const img of await page.getByTestId("closeup").all()) await expectLoaded(img);
      const b20 = reading("b", 20);
      expect(b20.now).not.toBe(reading("a", 30).now);
      await expect(page.getByTestId("measured-wrinkle-now")).toHaveText(b20.now.toFixed(1));
      await expect(page.getByTestId("measured-wrinkle-spf")).toHaveText(b20.spf.toFixed(1));
      await expect(main.getByText(copy.today).locator("..")).toContainText("38");
      // no +30 control at all (and no dead-end note): +20 is a static label, not a one-button switch
      await expect(thirty).toHaveCount(0);
      await expect(twenty).toHaveCount(0);
      await expect(main.getByText(thirtyLabel, { exact: true })).toHaveCount(0);
      await expect(page.getByTestId("horizon-static")).toHaveText(twentyLabel);
      await expect(main.getByRole("heading", { level: 1 })).toContainText("20");
      expect(await main.innerText()).not.toMatch(/NaN|undefined/);

      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
      expect(await noOverflow(page)).toBe(0);
      await page.screenshot({ path: `docs/screenshots/faces-${vp.name}.png`, animations: "disabled" });

      // and back to face a: +30 is there again
      await faceA.click();
      await expect(page).toHaveURL(/[?&]face=a/);
      await expect(faceA).toHaveAttribute("aria-current", "true");
      await expect(thirty).toBeEnabled();
      await expect(thirty).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByTestId("horizon-static")).toHaveCount(0);
      await expect(now).not.toHaveAttribute("src", /face=b/);
      await expect(page.getByTestId("measured-wrinkle-now")).toHaveText(reading("a", 30).now.toFixed(1));
      await expectLoaded(now);

      expect(errors).toEqual([]);
    });
  });
}

test("the switch works in the store widget's demo fallback and keeps the query", async ({ page }) => {
  const errors = collectErrors(page);
  const product = storeProduct(JSON.parse(readFileSync("fixtures/products.json", "utf8")).products as Product[])!;
  await page.goto(`/result?embed=1&product=${product.code}`);
  const fallback = page.getByRole("region", { name: "Or see it on our demo face" });
  const faceB = fallback.getByRole("group", { name: copy.eyebrow.demo }).getByRole("link", { name: copy.faces.b });
  await expect(faceB).toHaveAttribute("href", /embed=1/);
  await expect(faceB).toHaveAttribute("href", new RegExp(`product=${product.code}`));
  await faceB.click();
  await expect(page).toHaveURL(/embed=1/);
  await expect(page).toHaveURL(/face=b/);
  await expect(fallback.getByTestId("face-now")).toHaveAttribute("src", /face=b/);
  await expectLoaded(fallback.getByTestId("face-spf"));
  await expect(fallback.getByRole("button", { name: thirtyLabel })).toHaveCount(0);
  await expect(fallback.getByTestId("horizon-static")).toHaveText(twentyLabel);
  expect(errors).toEqual([]);
});

test("a result from the visitor's own selfie has no face switch", async ({ page }) => {
  const errors = collectErrors(page);
  await page.route("**/api/future", (route) =>
    route.request().method() === "POST" ? route.fulfill({ json: { ...demoResult(), source: "live" } }) : route.continue(),
  );
  await page.goto("/");
  await page.getByLabel(upload.city).fill("Lisbon");
  await page.getByLabel(upload.file).setInputFiles("fixtures/demo/input.jpg");
  await page.getByRole("button", { name: upload.submit }).click();
  await expectLoaded(page.getByTestId("face-now"));
  await expect(page.getByRole("group", { name: copy.eyebrow.demo })).toHaveCount(0);
  expect(errors).toEqual([]);
});

import { mkdirSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { routine as copy } from "../lib/copy";

// F21: the routine's product photos read as one clean set (same painted box on a neutral tile), the
// "Why this step" blocks and the action rows line up across the three cards, and the Open Beauty Facts
// link stays on one line at every width.

mkdirSync("docs/screenshots", { recursive: true });
mkdirSync("test-results", { recursive: true });

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

const settle = async (page: Page) => {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => document.getAnimations().every((x) => x.playState !== "running"));
};

const loaded = (img: Locator) => expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);

async function openRoutine(page: Page) {
  await page.goto("/result");
  await page.locator("main").getByRole("button", { name: copy.cta }).click();
  const section = page.getByRole("region", { name: new RegExp(copy.titlePrefix) });
  await expect(section.getByTestId("routine-step")).toHaveCount(3);
  for (const img of await section.getByTestId("routine-step").getByTestId("product-photo").all()) await loaded(img);
  await settle(page);
  return section;
}

/** The box the photo really paints: object-fit contain letterboxes inside the element box. */
const painted = (img: Locator) =>
  img.evaluate((el: HTMLImageElement) => {
    const r = el.getBoundingClientRect();
    const fit = getComputedStyle(el).objectFit;
    if (fit !== "contain" && fit !== "scale-down") return { w: r.width, h: r.height };
    const ratio = el.naturalWidth / el.naturalHeight;
    return r.width / r.height > ratio ? { w: r.height * ratio, h: r.height } : { w: r.width, h: r.width / ratio };
  });

const tops = (els: Locator) => els.evaluateAll((xs) => xs.map((x) => x.getBoundingClientRect().top));
const heights = (els: Locator) => els.evaluateAll((xs) => xs.map((x) => x.getBoundingClientRect().height));
const spread = (xs: number[]) => Math.max(...xs) - Math.min(...xs);

/** Text lines of an element's contents (1 = no wrap): glyph boxes whose centres sit within half a line are one line. */
const lines = (el: Locator) =>
  el.evaluate((a) => {
    const range = document.createRange();
    range.selectNodeContents(a);
    const half = parseFloat(getComputedStyle(a).fontSize) * 0.6;
    const ys = [...range.getClientRects()]
      .filter((r) => r.width > 0)
      .map((r) => r.top + r.height / 2)
      .sort((p, q) => p - q);
    return ys.filter((y, i) => i === 0 || y - ys[i - 1] > half).length;
  });

test.describe("routine tiles at 1440", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("photos share one painted box, why blocks and action rows line up", async ({ page }) => {
    const errors = collectErrors(page);
    const section = await openRoutine(page);
    const steps = section.getByTestId("routine-step");
    // the morning card carries the focus pill on the demo face: it must not push its rows down
    await expect(steps.first().getByTestId("focus-pill")).toBeVisible();

    const photos = await steps.getByTestId("product-photo").all();
    expect(photos).toHaveLength(3);
    const boxes = await Promise.all(photos.map(painted));
    expect(spread(boxes.map((b) => b.w))).toBeLessThanOrEqual(1);
    expect(spread(boxes.map((b) => b.h))).toBeLessThanOrEqual(1);
    for (const b of boxes) {
      // no strip: a packshot frame, roughly square or portrait, and a good size
      expect(b.w).toBeGreaterThan(140);
      expect(b.h / b.w).toBeGreaterThanOrEqual(0.95);
      expect(b.h / b.w).toBeLessThanOrEqual(1.3);
    }

    const why = steps.getByTestId("why");
    await expect(why).toHaveCount(3);
    expect(spread(await tops(why))).toBeLessThanOrEqual(1);
    expect(spread(await heights(why))).toBeLessThanOrEqual(1);
    const buy = steps.getByTestId("buy");
    await expect(buy).toHaveCount(3);
    expect(spread(await tops(buy))).toBeLessThanOrEqual(1);

    await section.screenshot({ path: "docs/screenshots/routine-tiles-1440.png", animations: "disabled" });
    expect(errors).toEqual([]);
  });

  test("the saved-list thumbnails use the same packshot frame", async ({ page }) => {
    const errors = collectErrors(page);
    const section = await openRoutine(page);
    for (const step of await section.getByTestId("routine-step").all()) await step.getByRole("button", { name: new RegExp(`^${copy.add} `) }).click();
    const thumbs = page.getByTestId("bag").getByTestId("product-photo");
    await expect(thumbs).toHaveCount(3);
    for (const t of await thumbs.all()) await loaded(t);
    const boxes = await Promise.all((await thumbs.all()).map(painted));
    expect(spread(boxes.map((b) => b.w))).toBeLessThanOrEqual(1);
    expect(spread(boxes.map((b) => b.h))).toBeLessThanOrEqual(1);
    for (const b of boxes) expect(b.w).toBeGreaterThanOrEqual(36);
    expect(errors).toEqual([]);
  });
});

for (const width of [1440, 1024, 768, 390]) {
  test(`at ${width} px the Open Beauty Facts link is one line and nothing overflows`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize({ width, height: 900 });
    const section = await openRoutine(page);
    const steps = section.getByTestId("routine-step");
    for (const step of await steps.all()) {
      const link = step.getByRole("link", { name: new RegExp(copy.obf) });
      await expect(link).toBeVisible();
      expect(await lines(link)).toBe(1);
      const card = (await step.boundingBox())!;
      const box = (await link.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(card.x);
      expect(box.x + box.width).toBeLessThanOrEqual(card.x + card.width + 0.5);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    // the sticky routine bar would float over a card in a full-section capture
    if (width === 390)
      await section.screenshot({ path: "docs/screenshots/routine-tiles-390.png", animations: "disabled", style: '[data-testid="bag-bar"]{visibility:hidden}' });
    if (width === 768 || width === 1024) await section.screenshot({ path: `test-results/routine-tiles-${width}.png`, animations: "disabled" });
    expect(errors).toEqual([]);
  });
}

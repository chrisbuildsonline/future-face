import { mkdirSync, readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { result as resultCopy, routine as copy, upload } from "../lib/copy";
import { productLabel, storeProduct, type Product } from "../lib/products";
import { routineFor } from "../lib/routine";

mkdirSync("docs/screenshots", { recursive: true });

const catalogue = JSON.parse(readFileSync("fixtures/products.json", "utf8")).products as Product[];
const uv = JSON.parse(readFileSync("fixtures/demo/uv.json", "utf8")) as { city: string; uvMax: number };
const r = routineFor(uv.uvMax, catalogue);
const [a, b] = r.steps.map((s) => s.product);
const count = (n: number) => `${n} ${n === 1 ? copy.item : copy.items}`;

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const loaded = (img: Locator) => expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);

async function openRoutine(page: Page) {
  await page.getByRole("button", { name: copy.cta }).click();
  const heading = page.getByRole("heading", { name: new RegExp(`${copy.titlePrefix} UV ${r.uv}`) });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  return page.getByRole("region", { name: new RegExp(copy.titlePrefix) });
}

const settle = async (page: Page) => {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => document.getAnimations().every((x) => x.playState !== "running"));
};

test.describe("routine at 1440", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("real products: photos, brand, Open Beauty Facts link, no prices, saved list", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/result");
    await expect(page.getByRole("link", { name: resultCopy.nav.own })).toBeVisible();
    const cta = page.getByRole("button", { name: copy.cta });
    await expect(cta).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByText(copy.ctaNote, { exact: true })).toBeVisible();

    const section = await openRoutine(page);
    await expect(cta).toHaveAttribute("aria-expanded", "true");
    await expect(section.getByText(uv.city, { exact: true })).toBeVisible();
    await expect(section.getByText(r.reapply, { exact: false })).toBeVisible();

    const steps = page.getByTestId("routine-step");
    await expect(steps).toHaveCount(r.steps.length);
    for (const [i, s] of r.steps.entries()) {
      const step = steps.nth(i);
      await expect(step).toHaveAttribute("data-code", s.product.code);
      await expect(step.getByText(s.label, { exact: true })).toBeVisible();
      await expect(step.getByRole("heading", { name: s.product.name })).toBeVisible();
      if (s.product.brand) await expect(step.getByText(s.product.brand, { exact: true })).toBeVisible();
      await expect(step.getByText(s.why)).toBeVisible();
      await loaded(step.getByTestId("product-photo"));
      const link = step.getByRole("link", { name: new RegExp(copy.obf) });
      await expect(link).toHaveAttribute("href", s.product.url!);
      await expect(link).toHaveAttribute("target", "_blank");
    }
    await expect(page.getByTestId("fit-pill")).toHaveCount(0);
    await expect(section.getByText(/€|\$\d|subtotal|checkout/i)).toHaveCount(0);
    await expect(section.getByText(copy.fiction)).toHaveCount(0);
    const attribution = section.getByRole("link", { name: copy.attribution });
    await expect(attribution).toBeVisible();
    await expect(attribution).toHaveAttribute("href", copy.attributionUrl);

    const list = page.getByTestId("bag");
    await expect(list.getByRole("heading", { name: copy.listTitle })).toBeVisible();
    await expect(list.getByTestId("bag-count")).toHaveText(count(0));
    const saveA = page.getByRole("button", { name: `${copy.add} ${a.name}` });
    await saveA.click();
    await expect(saveA).toHaveAttribute("aria-pressed", "true");
    await expect(saveA).toContainText(copy.added);
    await page.getByRole("button", { name: `${copy.add} ${b.name}` }).click();
    await expect(list.getByTestId("bag-count")).toHaveText(count(2));
    await expect(list.getByTestId("bag-item")).toHaveCount(2);
    await saveA.click();
    await expect(list.getByTestId("bag-item")).toHaveCount(1);
    await expect(list.getByTestId("bag-item")).toContainText(b.name);

    await section.scrollIntoViewIfNeeded();
    await page.getByRole("heading", { name: new RegExp(copy.titlePrefix) }).evaluate((el) => el.scrollIntoView({ block: "start" }));
    await settle(page);
    await page.screenshot({ path: "docs/screenshots/routine-desktop.png", animations: "disabled" });
    expect(errors).toEqual([]);
  });

  test("a preselected product is the morning step, with the fit pill, and the routine is open", async ({ page }) => {
    const errors = collectErrors(page);
    const p = storeProduct(catalogue)!;
    const fit = routineFor(uv.uvMax, catalogue, p.code).fit!;
    await page.goto(`/result?product=${p.code}`);
    await expect(page.getByTestId("with-product")).toContainText(`${copy.with} ${productLabel(p)}`);
    await expect(page.getByTestId("with-product").getByText(fit.line)).toBeVisible();
    const morning = page.locator('[data-testid="routine-step"][data-step="morning"]');
    await expect(morning).toHaveAttribute("data-code", p.code);
    await expect(morning.getByTestId("fit-pill")).toHaveText(fit.line);
    // opening without a click does not steal the scroll
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    // an unknown or malformed code is ignored
    for (const bad of ["0000000000000", "../etc", "abc"]) {
      await page.goto(`/result?product=${encodeURIComponent(bad)}`);
      await expect(page.getByTestId("with-product")).toHaveCount(0);
      await expect(page.getByTestId("routine-step")).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });

  test("embed mode with cart= shows Add to cart that posts to the parent", async ({ page }) => {
    const errors = collectErrors(page);
    await page.addInitScript(() => {
      const w = window as unknown as { __msgs: unknown[] };
      w.__msgs = [];
      window.addEventListener("message", (e) => w.__msgs.push(e.data));
    });
    const p = storeProduct(catalogue)!;
    const pr = routineFor(uv.uvMax, catalogue, p.code);
    const sold = [p.code, pr.steps[1].product.code];
    await page.goto(`/result?embed=1&product=${p.code}&cart=${sold.join(",")},nope`);
    await expect(page.locator("header nav")).toHaveCount(0);
    await expect(page.locator("footer")).toHaveCount(0);
    const steps = page.getByTestId("routine-step");
    await expect(steps.nth(0).getByRole("button", { name: new RegExp(copy.addToCart) })).toBeVisible();
    await expect(steps.nth(1).getByRole("button", { name: new RegExp(copy.addToCart) })).toBeVisible();
    await expect(steps.nth(2).getByRole("button", { name: new RegExp(copy.addToCart) })).toHaveCount(0);
    await expect(steps.nth(2).getByRole("button", { name: new RegExp(`^${copy.add} `) })).toBeVisible();

    await steps.nth(1).getByRole("button", { name: new RegExp(copy.addToCart) }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __msgs: unknown[] }).__msgs)).toContainEqual({
      type: "future-face:add",
      code: sold[1],
    });
    await page.getByRole("button", { name: "Close Future Face" }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __msgs: unknown[] }).__msgs)).toContainEqual({
      type: "future-face:close",
    });
    expect(errors).toEqual([]);
  });
});

test.describe("routine at 390", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("phone: stacked cards, routine bar and bottom sheet, no overflow", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/result");
    await openRoutine(page);
    await expect(page.getByTestId("bag")).toBeHidden();
    const bar = page.getByTestId("bag-bar");
    await expect(bar).toBeVisible();
    await expect(bar).toContainText(`${copy.listTitle} · ${count(0)}`);
    await expect(bar).not.toContainText("€");
    await page.getByRole("button", { name: `${copy.add} ${a.name}` }).click();
    await page.getByRole("button", { name: `${copy.add} ${b.name}` }).click();
    await expect(bar).toContainText(count(2));
    expect(await noOverflow(page)).toBe(0);
    await page.getByRole("heading", { name: new RegExp(copy.titlePrefix) }).evaluate((el) => el.scrollIntoView({ block: "start" }));
    await settle(page);
    await page.screenshot({ path: "docs/screenshots/routine-phone.png", animations: "disabled" });

    await bar.getByRole("button", { name: copy.viewList }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId("bag-item")).toHaveCount(2);
    await expect(sheet.getByTestId("bag-count")).toHaveText(count(2));
    await expect
      .poll(async () => {
        const box = (await sheet.boundingBox())!;
        return Math.round(box.y + box.height);
      })
      .toBe(844);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(bar.getByRole("button", { name: copy.viewList })).toBeFocused();
    expect(errors).toEqual([]);
  });
});

test("the routine opens from the in-place upload result on the landing", async ({ page, request }) => {
  const errors = collectErrors(page);
  const demo = await (await request.get("/api/future")).json();
  const routine = routineFor(demo.uv.uvMax, catalogue);
  await page.route("**/api/future", (route) =>
    route.request().method() === "POST" ? route.fulfill({ json: demo }) : route.continue(),
  );
  await page.goto("/");
  await page.getByLabel(upload.city).fill("Lisbon");
  await page.getByLabel(upload.file).setInputFiles("fixtures/demo/input.jpg");
  await page.getByRole("button", { name: upload.submit }).click();

  await page.getByRole("button", { name: copy.cta }).click();
  await expect(page.getByRole("heading", { name: new RegExp(`${copy.titlePrefix} UV ${routine.uv}`) })).toBeVisible();
  await expect(page.getByTestId("routine-step")).toHaveCount(routine.steps.length);
  await loaded(page.getByTestId("routine-step").first().getByTestId("product-photo"));

  const first = routine.steps[0].product;
  await page.getByRole("button", { name: `${copy.add} ${first.name}` }).click();
  const list = page.getByTestId("bag").filter({ visible: true });
  await expect(list.getByTestId("bag-count")).toHaveText(count(1));
  expect(errors).toEqual([]);
});

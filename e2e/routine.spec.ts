import { mkdirSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { result as resultCopy, routine as copy, upload } from "../lib/copy";
import { bagTotal, buildRoutine, formatPrice } from "../lib/routine";

mkdirSync("docs/screenshots", { recursive: true });

const uv = JSON.parse(readFileSync("fixtures/demo/uv.json", "utf8")) as { city: string; uvMax: number };
const r = buildRoutine(uv.uvMax);
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

async function openRoutine(page: Page) {
  await page.getByRole("button", { name: copy.cta }).click();
  const heading = page.getByRole("heading", { name: new RegExp(`${copy.titlePrefix} UV ${r.uv}`) });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  return heading;
}

test.describe("routine at 1440", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("build my SPF routine: three steps, add, toggle, subtotal, demo checkout", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/result");

    // one primary pill on the view; "Try your own selfie" stays as a secondary link
    await expect(page.getByRole("link", { name: resultCopy.nav.own })).toBeVisible();
    const cta = page.getByRole("button", { name: copy.cta });
    await expect(cta).toHaveAttribute("aria-expanded", "false");

    await openRoutine(page);
    await expect(cta).toHaveAttribute("aria-expanded", "true");
    const section = page.getByRole("region", { name: new RegExp(copy.titlePrefix) });
    await expect(section.getByText(uv.city, { exact: true })).toBeVisible();
    await expect(section.getByText(`SPF ${r.spf}`).first()).toBeVisible();
    await expect(section.getByText(r.reapply, { exact: false })).toBeVisible();

    const steps = page.getByTestId("routine-step");
    await expect(steps).toHaveCount(3);
    for (const [i, s] of r.steps.entries()) {
      const step = steps.nth(i);
      await expect(step.getByText(s.label, { exact: true })).toBeVisible();
      await expect(step.getByText(s.product.name, { exact: true })).toBeVisible();
      await expect(step.getByText(s.product.size, { exact: false }).first()).toBeVisible();
      await expect(step.getByText(formatPrice(s.product.priceCents), { exact: true })).toBeVisible();
      await expect(step.getByText(s.why)).toBeVisible();
      await expect(step.locator("svg[data-format]")).toBeVisible();
    }
    // each product format gets its own illustration
    const formats = await steps.locator("svg[data-format]").evaluateAll((els) => els.map((e) => e.getAttribute("data-format")));
    expect(new Set(formats).size).toBe(3);

    const bag = page.getByTestId("bag").filter({ visible: true });
    await expect(bag).toHaveCount(1);
    await expect(bag.getByText(copy.bagEmpty)).toBeVisible();

    const addA = page.getByRole("button", { name: `${copy.add} ${a.name}` });
    const addB = page.getByRole("button", { name: `${copy.add} ${b.name}` });
    await addA.click();
    await expect(addA).toHaveAttribute("aria-pressed", "true");
    await expect(bag.getByTestId("bag-count")).toHaveText(count(1));
    await expect(bag.getByTestId("bag-item")).toHaveCount(1);
    await expect(bag.getByTestId("bag-item")).toContainText(a.name);
    await expect(bag.getByTestId("bag-item")).toContainText(formatPrice(a.priceCents));
    await expect(bag.getByTestId("bag-subtotal")).toHaveText(formatPrice(a.priceCents));

    await addB.click();
    await expect(addB).toHaveAttribute("aria-pressed", "true");
    await expect(bag.getByTestId("bag-count")).toHaveText(count(2));
    await expect(bag.getByTestId("bag-subtotal")).toHaveText(formatPrice(bagTotal([a.id, b.id])));

    await addA.click();
    await expect(addA).toHaveAttribute("aria-pressed", "false");
    await expect(bag.getByTestId("bag-count")).toHaveText(count(1));
    await expect(bag.getByTestId("bag-item")).toHaveCount(1);
    await expect(bag.getByTestId("bag-subtotal")).toHaveText(formatPrice(b.priceCents));

    await addA.click();
    await expect(bag.getByTestId("bag-count")).toHaveText(count(2));

    const url = page.url();
    await bag.getByRole("button", { name: copy.checkout }).click();
    await expect(bag.getByText(copy.demoNote)).toBeVisible();
    expect(page.url()).toBe(url);

    await expect(page.getByTestId("bag-bar")).toBeHidden();
    expect(await noOverflow(page)).toBe(0);

    await page.evaluate(() => document.fonts.ready);
    await section.getByRole("heading", { level: 2 }).evaluate((el) => {
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 96, behavior: "instant" });
    });
    await page.screenshot({ path: "docs/screenshots/routine-desktop.png", animations: "disabled" });
    expect(errors).toEqual([]);
  });
});

test.describe("routine at 390", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the pill is pinned, steps stack, and the bag bar opens a bottom sheet", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/result");
    const cta = page.getByRole("button", { name: copy.cta });
    await expect(cta).toBeInViewport();
    const box = (await cta.boundingBox())!;
    expect(box.y + box.height).toBeGreaterThan(844 - 120);
    expect(box.width).toBeGreaterThan(300);

    await openRoutine(page);
    const steps = page.getByTestId("routine-step");
    await expect(steps).toHaveCount(3);
    // vertical list: measured in one frame, since the section fades up on entrance
    const stacked = await steps.evaluateAll((els) => {
      const [a, b] = els.map((e) => e.getBoundingClientRect());
      return b.top >= a.bottom - 1 && Math.abs(a.left - b.left) < 1;
    });
    expect(stacked).toBe(true);

    // the rail bag is the desktop layout; the phone uses the bar
    await expect(page.getByTestId("bag").filter({ visible: true })).toHaveCount(0);
    const bar = page.getByTestId("bag-bar");
    await expect(bar).toBeInViewport();
    await expect(bar).toContainText(`${count(0)} · ${formatPrice(0)}`);

    const addA = page.getByRole("button", { name: `${copy.add} ${a.name}` });
    await addA.click();
    await expect(addA).toHaveAttribute("aria-pressed", "true");
    const addBox = (await addA.boundingBox())!;
    expect(addBox.width).toBeGreaterThanOrEqual(44);
    expect(addBox.height).toBeGreaterThanOrEqual(44);
    await expect(bar).toContainText(`${count(1)} · ${formatPrice(a.priceCents)}`);
    await page.getByRole("button", { name: `${copy.add} ${b.name}` }).click();
    await expect(bar).toContainText(`${count(2)} · ${formatPrice(bagTotal([a.id, b.id]))}`);

    expect(await noOverflow(page)).toBe(0);
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole("region", { name: new RegExp(copy.titlePrefix) }).getByRole("heading", { level: 2 }).evaluate((el) => {
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 64, behavior: "instant" });
    });
    await page.screenshot({ path: "docs/screenshots/routine-phone.png", animations: "disabled" });

    await bar.getByRole("button", { name: copy.viewBag }).click();
    const sheet = page.getByRole("dialog", { name: copy.bagTitle });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId("bag-item")).toHaveCount(2);
    await expect(sheet.getByTestId("bag-subtotal")).toHaveText(formatPrice(bagTotal([a.id, b.id])));
    await expect(sheet.getByRole("button", { name: copy.close })).toBeFocused();
    // the sheet slides up, then sits flush on the bottom edge
    await expect
      .poll(async () => {
        const box = (await sheet.boundingBox())!;
        return Math.round(box.y + box.height);
      })
      .toBe(844);
    expect(await noOverflow(page)).toBe(0);
    await page.screenshot({ path: "test-results/routine-phone-sheet.png", animations: "disabled" });

    await sheet.getByRole("button", { name: copy.checkout }).click();
    await expect(sheet.getByText(copy.demoNote)).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(bar.getByRole("button", { name: copy.viewBag })).toBeFocused();
    expect(errors).toEqual([]);
  });
});

test("the routine opens from the in-place upload result on the landing", async ({ page, request }) => {
  const errors = collectErrors(page);
  const demo = await (await request.get("/api/future")).json();
  const routine = buildRoutine(demo.uv.uvMax);
  await page.route("**/api/future", (route) =>
    route.request().method() === "POST" ? route.fulfill({ json: demo }) : route.continue(),
  );
  await page.goto("/");
  await page.getByLabel(upload.city).fill("Lisbon");
  await page.getByLabel(upload.file).setInputFiles("fixtures/demo/input.jpg");
  await page.getByRole("button", { name: upload.submit }).click();

  await page.getByRole("button", { name: copy.cta }).click();
  const heading = page.getByRole("heading", { name: new RegExp(`${copy.titlePrefix} UV ${routine.uv}`) });
  await expect(heading).toBeVisible();
  await expect(page.getByTestId("routine-step")).toHaveCount(3);

  const first = routine.steps[0].product;
  await page.getByRole("button", { name: `${copy.add} ${first.name}` }).click();
  const bag = page.getByTestId("bag").filter({ visible: true });
  await expect(bag.getByTestId("bag-count")).toHaveText(count(1));
  await expect(bag.getByTestId("bag-subtotal")).toHaveText(formatPrice(first.priceCents));
  expect(errors).toEqual([]);
});

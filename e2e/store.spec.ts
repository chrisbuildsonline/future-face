import { mkdirSync, readFileSync } from "node:fs";
import { expect, test, type Frame, type Page } from "@playwright/test";
import { embed, errors as errorCopy, upload } from "../lib/copy";
import { productLabel, storeProduct, type Product } from "../lib/products";
import { routineFor } from "../lib/routine";

mkdirSync("docs/screenshots", { recursive: true });

// Never a hardcoded code: the first SPF 50+ cream in the fixture, as the store preview and landing link use.
const catalogue = JSON.parse(readFileSync("fixtures/products.json", "utf8")).products as Product[];
const product = storeProduct(catalogue)!;
const uv = JSON.parse(readFileSync("fixtures/demo/uv.json", "utf8")) as { uvMax: number };
const fit = routineFor(uv.uvMax, catalogue, product.code).fit!;
// A sunscreen whose Open Beauty Facts name already starts with its brand ("Daylong Daylong ..." was the bug).
const branded = catalogue.find((p) => p.spf && p.brand && p.name.toLowerCase().startsWith(p.brand.toLowerCase()))!;
const wide = "e2e/fixtures/wide-selfie.jpg";
const timesIn = (text: string, word: string) => text.toLowerCase().split(word.toLowerCase()).length - 1;

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

const settle = async (f: Page | Frame) => {
  await f.evaluate(() => document.fonts.ready);
  await f.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
};

const pillOf = (page: Page, p: Product = product) => page.getByRole("button", { name: `See your face in 30 years with SPF ${p.spf}` });

async function openModal(page: Page, p: Product = product) {
  await pillOf(page, p).click();
  const iframe = page.locator("iframe[title^='Future Face']");
  await expect(iframe).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe("IFRAME");
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  const f = (await (await iframe.elementHandle())!.contentFrame())!;
  await f.waitForURL(new RegExp(`/result\\?embed=1&product=${p.code}`));
  return { iframe, f };
}

// The server's no-key answer (demo result + no_key notice), without the live city lookup. Like every
// spec that submits, never let a POST reach the real route: a YOUCAM_SECRET_KEY in .env would run live.
async function mockNoKey(page: Page) {
  const demo = await (await page.request.get("/api/future")).json();
  const posts: string[] = [];
  await page.route("**/api/future", (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const body = route.request().postDataBuffer() ?? Buffer.alloc(0);
    posts.push(["selfie", "city"].filter((k) => body.includes(Buffer.from(`name="${k}"`))).join(","));
    return route.fulfill({ json: { ...demo, notice: errorCopy.no_key } });
  });
  return posts;
}

const frameOverflow = (f: Frame) => f.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const [name, viewport] of [
  ["desktop", { width: 1440, height: 900 }],
  ["phone", { width: 390, height: 844 }],
] as const) {
  test.describe(`store preview at ${viewport.width}`, () => {
    test.use({ viewport });

    test("product page, widget pill, modal with the product's result, close and Esc", async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto(`/store/${product.code}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(product.name);
      await expect(page.getByText("Store preview", { exact: true })).toBeVisible();
      await expect(page.getByText("Price set by the store", { exact: true })).toBeVisible();
      await expect(page.locator("main").getByRole("button", { name: "Add to cart" })).toBeEnabled(); // fills the preview bag (store-links.spec)
      await expect(page.getByText(/€|\$\d/)).toHaveCount(0);
      const photo = page.getByRole("img", { name: productLabel(product) });
      await expect.poll(() => photo.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
      await page.getByText("Ingredients", { exact: true }).click();
      await expect(page.getByText(product.ingredients.slice(0, 30), { exact: false })).toBeVisible();
      await page.getByText("Ingredients", { exact: true }).click();
      await expect(page.locator("pre code")).toContainText('<script src="http://localhost:3000/widget.js" defer></script>');
      const pill = pillOf(page);
      await expect(pill).toBeVisible();
      if (name === "phone") {
        // photo first, then the buy area; the pill is reachable without hunting
        const [p, b] = [await photo.boundingBox(), await pill.boundingBox()];
        expect(p!.y).toBeLessThan(b!.y);
        expect(b!.width).toBeLessThanOrEqual(viewport.width - 32);
      }
      expect(await noOverflow(page)).toBeLessThanOrEqual(0);
      await settle(page);
      await page.screenshot({ path: `docs/screenshots/store-${name}.png`, animations: "disabled" });

      // open: the iframe's result is that product, the morning step is it, with the fit pill
      const { iframe, f } = await openModal(page);
      await expect(f.getByTestId("with-product")).toContainText(product.name);
      const morning = f.locator('[data-testid="routine-step"][data-step="morning"]');
      await expect(morning).toHaveAttribute("data-code", product.code);
      await expect(morning.getByText(product.name, { exact: true })).toBeVisible();
      await expect(morning.getByTestId("fit-pill")).toHaveText(fit.line);
      await expect(f.getByRole("link", { name: "Future Face" })).toHaveCount(0); // no site nav in embed mode
      await expect(f.locator("footer")).toHaveCount(0);
      const box = (await iframe.boundingBox())!;
      if (name === "phone") expect(box.width).toBeGreaterThanOrEqual(viewport.width - 1);
      else expect(box.width).toBeLessThanOrEqual(1180);

      // the iframe's close button closes it and focus returns to the pill
      await f.getByRole("button", { name: "Close Future Face" }).click();
      await expect(iframe).toHaveCount(0);
      await expect(pill).toBeFocused();
      expect(await page.evaluate(() => document.body.style.overflow)).toBe("");

      // Esc closes too (focus is inside the iframe)
      await openModal(page);
      await page.keyboard.press("Escape");
      await expect(iframe).toHaveCount(0);
      await expect(pill).toBeFocused();

      if (name === "desktop") {
        // a backdrop click closes it
        await openModal(page);
        await page.mouse.click(8, 8);
        await expect(iframe).toHaveCount(0);
      }
      expect(errors).toEqual([]);
    });

    test("embed: own selfie first, demo face below with the product named once, a selfie reaches a result with it", async ({ page }) => {
      test.setTimeout(90_000);
      expect(branded, "fixtures/products.json has a sunscreen whose name starts with its brand").toBeTruthy();
      const label = productLabel(branded);
      const errors = collectErrors(page);
      const posts = await mockNoKey(page); // page.route covers the iframe's requests too
      await page.goto(`/store/${branded.code}`);
      const { iframe, f } = await openModal(page, branded);
      const fbox = (await iframe.boundingBox())!;

      // 1. the upload card comes first, its primary action in the first view (thumb zone on a phone)
      const title = f.getByRole("heading", { level: 1 });
      await expect(title).toHaveText(embed.title);
      const form = f.locator("form").filter({ has: f.getByRole("button", { name: upload.submit }) });
      await expect(form).toBeVisible();
      await expect(f.getByLabel(upload.file)).toBeAttached();
      await expect(f.getByLabel(upload.city)).toBeVisible();
      const submit = f.getByRole("button", { name: upload.submit });
      const sbox = (await submit.boundingBox())!;
      expect(sbox.y + sbox.height).toBeLessThanOrEqual(fbox.y + fbox.height);
      expect(sbox.height).toBeGreaterThanOrEqual(56);
      if (name === "phone") {
        expect(sbox.y - fbox.y).toBeGreaterThan(fbox.height * 0.5);
        expect(sbox.width).toBeGreaterThanOrEqual((await form.boundingBox())!.width - 48); // full width of the card
      }

      // 2. the demo face is a labelled fallback below the card, naming the product with its brand once
      const fallback = f.getByRole("region", { name: embed.fallback });
      await expect(fallback).toBeAttached();
      const [formBox, fallBox] = [await form.boundingBox(), await fallback.boundingBox()];
      expect(fallBox!.y).toBeGreaterThanOrEqual(formBox!.y + formBox!.height);
      await expect(fallback.getByText("Demo face", { exact: true })).toBeAttached();
      const withLine = fallback.getByTestId("with-product");
      await expect(withLine.locator("b")).toHaveText(label);
      await expect(withLine).toContainText(`With ${label}`);
      expect(timesIn((await withLine.textContent())!, branded.brand!)).toBe(1);
      await expect(fallback.locator('[data-testid="routine-step"][data-step="morning"]')).toHaveAttribute("data-code", branded.code);

      expect(await noOverflow(page)).toBeLessThanOrEqual(0);
      expect(await frameOverflow(f)).toBeLessThanOrEqual(0);
      await settle(f);
      await page.screenshot({ path: `docs/screenshots/store-modal-${name}.png`, animations: "disabled" });

      // 3. a selfie: auto-cropped, sent, and its result in place still names that product
      await f.getByLabel(upload.city).fill("Lisbon");
      await f.getByLabel(upload.file).setInputFiles(wide);
      await expect(form.getByRole("status").first()).toHaveText(upload.cropDone, { timeout: 20_000 });
      await submit.click();
      const mine = f.getByTestId("upload-result");
      await expect(mine).toBeVisible();
      expect(posts).toEqual(["selfie,city"]);
      await expect(mine.getByText(errorCopy.no_key)).toBeVisible(); // no key: the demo result, with a notice
      await expect(mine.getByTestId("with-product").locator("b")).toHaveText(label);
      await expect(fallback).toBeAttached(); // the demo stays below
      expect(await frameOverflow(f)).toBeLessThanOrEqual(0);
      expect(errors).toEqual([]);
    });
  });
}

test("embed: the product and the store's cart reach the result of an uploaded selfie", async ({ page }) => {
  const errors = collectErrors(page);
  await mockNoKey(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/result?embed=1&product=${branded.code}&cart=${branded.code}`);
  await page.getByLabel(upload.city).fill("Lisbon");
  await page.getByLabel(upload.file).setInputFiles(wide);
  await expect(page.getByRole("button", { name: upload.submit })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: upload.submit }).click();
  const mine = page.getByTestId("upload-result");
  await expect(mine.getByTestId("with-product").locator("b")).toHaveText(productLabel(branded));
  const morning = mine.locator('[data-testid="routine-step"][data-step="morning"]');
  await expect(morning).toHaveAttribute("data-code", branded.code);
  await expect(morning.getByRole("button", { name: `Add to cart: ${productLabel(branded)}` })).toBeVisible();
  expect(errors).toEqual([]);
});

test("unknown store codes are a 404", async ({ page }) => {
  for (const bad of ["0000000000000", "abc"]) {
    const res = await page.goto(`/store/${bad}`);
    expect(res?.status()).toBe(404);
  }
});

test("landing: See it in a store points at the preview, makes no request to :8080, logs nothing", async ({ page }) => {
  const errors = collectErrors(page);
  const probes: string[] = [];
  page.on("request", (req) => {
    if (req.url().startsWith("http://localhost:8080")) probes.push(req.url());
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("link", { name: "See it in a store" })).toHaveAttribute("href", `/store/${product.code}`);
  expect(probes).toEqual([]);
  expect(errors).toEqual([]);
});

test("widget.js stays small and dependency free", () => {
  const src = readFileSync("public/widget.js", "utf8");
  expect(Buffer.byteLength(src)).toBeLessThan(8 * 1024);
  expect(src).not.toMatch(/\bimport\b|\brequire\(/);
});

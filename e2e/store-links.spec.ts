import { mkdirSync, readFileSync } from "node:fs";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { storeProduct, type Product } from "../lib/products";

mkdirSync("docs/screenshots", { recursive: true });

// The store preview had dead links: spans for nav and breadcrumb, a logo pointing at the same product,
// no /store index, a disabled Add to cart. Every link here must lead somewhere real.
const catalogue = JSON.parse(readFileSync("fixtures/products.json", "utf8")).products as Product[];
const product = storeProduct(catalogue)!;
const kindOf = new Map(catalogue.map((p) => [p.code, p.kind]));
const WOO = "https://github.com/chrisbuildsonline/future-face#run-it-in-a-store-woocommerce-two-commands";
const PREVIEW_LINE = "Preview only, nothing is sold here.";
const WOO_LINE = "This shop also runs as a real WooCommerce store";

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

const settle = async (page: Page) => {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
};

/** Every same-origin href on the page answers 200 (hash dropped). */
async function internalLinksOk(page: Page, request: APIRequestContext) {
  const hrefs = await page.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
  const internal = [...new Set(hrefs.filter((h) => h.startsWith("/")).map((h) => h.split("#")[0] || "/"))];
  expect(internal.length).toBeGreaterThanOrEqual(2); // a product page has only /store (+ anchors) and /
  for (const href of internal) expect((await request.get(href)).status(), href).toBe(200);
  return hrefs;
}

/** Nav: only links, each to a group anchor that exists on /store. Logo goes to /store. */
async function navIsReal(page: Page, request: APIRequestContext) {
  const nav = page.getByRole("navigation", { name: "Shop" });
  await expect(nav).toBeVisible();
  await expect(nav.locator(":scope *:not(a):not(a *)")).toHaveCount(0); // no span pretending to be a link
  const links = await nav.locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
  expect(links.length).toBeGreaterThanOrEqual(3);
  const html = await (await request.get("/store")).text();
  for (const href of links) {
    expect(href, "nav goes to the catalogue").toMatch(/^\/store(#[a-z-]+)?$/);
    const id = href.split("#")[1];
    if (id) expect(html, `#${id} exists on /store`).toContain(`id="${id}"`);
  }
  await expect(page.getByRole("link", { name: "Sunday Pharmacy", exact: true })).toHaveAttribute("href", "/store");
  return links;
}

/** Breadcrumb: every item but the current one is a link. */
async function crumbsAreReal(page: Page) {
  const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(crumbs).toBeVisible();
  const items = crumbs.locator("li");
  const n = await items.count();
  expect(n).toBeGreaterThanOrEqual(2);
  for (let i = 0; i < n - 1; i++) await expect(items.nth(i).locator("a[href]")).toHaveCount(1);
  await expect(items.nth(n - 1).locator("[aria-current='page']")).toHaveCount(1);
  return crumbs;
}

for (const width of [1440, 390] as const) {
  test.describe(`store links at ${width}`, () => {
    test.use({ viewport: { width, height: width === 1440 ? 900 : 844 } });

    test("/store is a catalogue grouped by kind; nav, breadcrumb, logo and cards all lead somewhere", async ({ page, request }) => {
      const errors = collectErrors(page);
      const res = await page.goto("/store");
      expect(res?.status()).toBe(200);
      const main = page.locator("main");
      await expect(main.getByRole("heading", { level: 1 })).toBeVisible();

      // every product of the catalogue, once, as a card linking to its page
      for (const p of catalogue) await expect(main.locator(`a[href="/store/${p.code}"]`)).toHaveCount(1);

      // grouped: each group is a section with an id and a heading; no kind is split across groups
      const groups = main.locator("section[id]");
      const ids = await groups.evaluateAll((ss) => ss.map((s) => s.id));
      expect(ids.length).toBeGreaterThanOrEqual(3);
      const seen = new Map<string, string>();
      let cards = 0;
      for (const id of ids) {
        const group = main.locator(`section#${id}`);
        await expect(group.getByRole("heading", { level: 2 })).toBeVisible();
        const codes = await group.locator("a[href^='/store/']").evaluateAll((as) => as.map((a) => a.getAttribute("href")!.slice(7)));
        expect(codes.length, `#${id} has products`).toBeGreaterThan(0);
        cards += codes.length;
        for (const code of codes) {
          const kind = kindOf.get(code)!;
          expect(seen.get(kind) ?? id, `${kind} only in one group`).toBe(id);
          seen.set(kind, id);
        }
      }
      expect(cards).toBe(catalogue.length);

      const nav = await navIsReal(page, request);
      for (const href of nav.filter((h) => h.includes("#"))) expect(ids).toContain(href.split("#")[1]);
      await crumbsAreReal(page);
      await expect(page.getByRole("link", { name: WOO_LINE })).toHaveAttribute("href", WOO);
      await internalLinksOk(page, request);
      expect(await noOverflow(page)).toBeLessThanOrEqual(0);

      // each card fits its own column; cards on a row never overlap (a long meta line once pushed one over its neighbour)
      for (const id of ids) {
        const boxes = await main.locator(`section#${id} a[href^='/store/']`).evaluateAll((as) =>
          as.map((a) => {
            const r = a.getBoundingClientRect();
            const li = a.closest("li")!.getBoundingClientRect();
            return { code: a.getAttribute("href")!.slice(7), left: r.left, right: r.right, top: r.top, liRight: li.right };
          }),
        );
        for (const b of boxes) expect(b.right, `#${id} ${b.code} fits its column`).toBeLessThanOrEqual(b.liRight + 1);
        for (const a of boxes)
          for (const b of boxes)
            if (a !== b && Math.abs(a.top - b.top) < 1 && a.left < b.left)
              expect(a.right, `#${id} ${a.code} overlaps ${b.code}`).toBeLessThanOrEqual(b.left + 1);
      }

      await settle(page);
      await page.screenshot({ path: `docs/screenshots/store-catalogue-${width}.png`, fullPage: true, animations: "disabled" });

      // walk: a nav item scrolls to its group
      const second = page.getByRole("navigation", { name: "Shop" }).locator("a[href*='#']").nth(1);
      const target = (await second.getAttribute("href"))!;
      await second.click();
      await expect(page).toHaveURL(new RegExp(`${target}$`));
      await expect(page.locator(`#${target.split("#")[1]}`).getByRole("heading", { level: 2 })).toBeInViewport();

      // walk: three cards, one from each of the first three groups, open their product page
      for (const id of ids.slice(0, 3)) {
        await page.goto("/store");
        const card = main.locator(`section#${id} a[href^='/store/']`).first();
        const code = (await card.getAttribute("href"))!.slice(7);
        await card.click();
        await expect(page).toHaveURL(new RegExp(`/store/${code}$`));
        await expect(page.locator("main").getByRole("heading", { level: 1 })).toHaveText(catalogue.find((p) => p.code === code)!.name);
      }
      expect(errors).toEqual([]);
    });

    test("product page: nav, breadcrumb and logo are links; Add to cart fills the preview bag", async ({ page, request }) => {
      const errors = collectErrors(page);
      await page.goto(`/store/${product.code}`);
      await navIsReal(page, request);
      const crumbs = await crumbsAreReal(page);
      await expect(crumbs.locator("[aria-current='page']")).toHaveText(product.name);
      await expect(page.getByRole("link", { name: WOO_LINE })).toHaveAttribute("href", WOO);
      await internalLinksOk(page, request);

      // the widget pill is still there
      await expect(page.getByRole("button", { name: `See your face in 30 years with SPF ${product.spf}` })).toBeVisible();

      // Add to cart: enabled, 0 -> 1, the bag lists it with the preview-only line
      const count = page.getByTestId("bag-count");
      await expect(count).toHaveText("0");
      const add = page.locator("main").getByRole("button", { name: "Add to cart" });
      await expect(add).toBeEnabled();
      await add.click();
      await expect(count).toHaveText("1");
      const bag = page.getByRole("dialog", { name: "Your bag" });
      await expect(bag).toBeVisible();
      await expect(bag.getByText(product.name, { exact: true })).toBeVisible();
      await expect(bag.getByText(PREVIEW_LINE, { exact: true })).toBeVisible();
      await expect(page.getByText(/€|\$\d/)).toHaveCount(0); // no invented prices
      expect(await noOverflow(page)).toBeLessThanOrEqual(0);
      await settle(page);
      await page.screenshot({ path: `docs/screenshots/store-bag-${width}.png`, animations: "disabled" });
      await page.keyboard.press("Escape");
      await expect(bag).toBeHidden();

      // the bag is kept across pages
      await page.getByRole("link", { name: "Sunday Pharmacy", exact: true }).click();
      await expect(page).toHaveURL(/\/store$/);
      await expect(count).toHaveText("1");

      // breadcrumb from the product page goes to its group
      await page.goto(`/store/${product.code}`);
      const group = crumbs.locator("a[href^='/store#']");
      const href = (await group.getAttribute("href"))!;
      await group.click();
      await expect(page).toHaveURL(new RegExp(`${href}$`));
      await expect(page.locator(`#${href.split("#")[1]} a[href="/store/${product.code}"]`)).toHaveCount(1);
      expect(errors).toEqual([]);
    });
  });
}

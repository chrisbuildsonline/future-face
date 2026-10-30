import { mkdirSync, readFileSync } from "node:fs";
import { expect, test, type Frame, type Locator, type Page } from "@playwright/test";
import { productLabel, storeProduct, type Product } from "../lib/products";

// Walks docs/DEMO.md steps 1-10 in order. Every label below is typed out as the script writes it
// (not imported from lib/copy), so a copy change that breaks the demo script fails here.
// The product is read from fixtures/products.json the way the script says: the first SPF 50 cream.

mkdirSync("test-results", { recursive: true });

const product = storeProduct(JSON.parse(readFileSync("fixtures/products.json", "utf8")).products as Product[])!;
const label = productLabel(product);

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

const settle = async (f: Frame) => {
  await f.evaluate(() => document.fonts.ready);
  await f.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
};

const clipOf = (img: Locator) => img.evaluate((el) => getComputedStyle(el).clipPath);

test.use({ viewport: { width: 1440, height: 900 } });

test("demo script: steps 1 to 10 of docs/DEMO.md run end to end", async ({ page }) => {
  const errors = collectErrors(page);

  // 1. Landing
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Meet yourself at 45. Twice.");
  await expect(page.getByText("YouCam Skin AI", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "See it in a store" }).click();

  // 2. The store product page
  await expect(page).toHaveURL(new RegExp(`/store/${product.code}$`));
  await expect(page.getByText("Sunday Pharmacy").first()).toBeVisible();
  await expect(page.getByText("Store preview", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(product.name);
  await expectLoaded(page.getByRole("img", { name: label }));
  await expect(page.getByText("Price set by the store", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Add this to your store in two lines" })).toBeVisible();
  const pill = page.getByRole("button", { name: "See your face in 20 years with SPF 50" });
  await expect(pill).toBeVisible();

  // 3. Open the result
  await pill.click();
  const iframe = page.locator("iframe[title^='Future Face']");
  await expect(iframe).toBeVisible();
  const f = (await (await iframe.elementHandle())!.contentFrame())!;
  await f.waitForURL(/\/result\?embed=1/);
  const now = f.getByTestId("face-now");
  const spf = f.getByTestId("face-spf");
  await expectLoaded(now);
  await expectLoaded(spf);
  // the shopper's own selfie comes first; the recorded demo face is the fallback below it
  await expect(f.getByRole("heading", { level: 1 })).toHaveText("Try this SPF on your face.");
  await expect(f.getByRole("button", { name: "Show my two futures" })).toBeVisible();
  const main = f.getByRole("region", { name: "Or see it on our demo face" });
  await main.getByText("Demo face", { exact: true }).scrollIntoViewIfNeeded();
  await expect(main.getByText("Demo face", { exact: true })).toBeVisible();
  await expect(main.getByText("Age read today").locator("..")).toHaveText(/Age read today\s*38/);
  await expect(main.getByText("Nambour · UV 7.8", { exact: true })).toBeVisible();
  await expect(main.getByRole("heading", { level: 2, name: "You at 58. Twice." })).toBeVisible();
  const withLine = main.getByTestId("with-product");
  await expect(withLine).toContainText(`With ${label}`);
  await expect(withLine.getByText("SPF 50 covers a UV 7.8 day", { exact: true })).toBeVisible();
  await settle(f);

  // 4. The slider: a real mouse drag across the face
  const slider = f.getByRole("slider", { name: "Divider between the two futures" });
  await slider.scrollIntoViewIfNeeded();
  const box = (await slider.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.5, y);
  await page.mouse.down();
  const before = Number(await slider.inputValue());
  const clipBefore = await clipOf(spf);
  await page.mouse.move(box.x + box.width * 0.2, y, { steps: 12 });
  await page.mouse.up();
  const after = Number(await slider.inputValue());
  expect(after).toBeLessThan(before - 15);
  expect(after).toBeGreaterThan(10);
  await expect.poll(() => clipOf(spf)).not.toBe(clipBefore);
  await expect(f.getByText("Illustrative projection, not a prognosis.", { exact: true })).toBeVisible();
  const frame = f.locator("figure").filter({ has: slider });
  await expect(frame.getByText("As you live now").first()).toBeVisible();
  await expect(frame.getByText("With daily SPF").first()).toBeVisible();

  // 5. Where 0.24 comes from
  const chip = f.getByRole("button", { name: "Source, Wrinkles 0.24" });
  await chip.evaluate((el) => {
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 120, behavior: "instant" });
  });
  await chip.click();
  await expect(f.locator("[popover]:popover-open").getByText("Why this intensity · 0.24")).toBeVisible();
  const doi = f.getByRole("link", { name: /10\.7326\/0003-4819-158-11-201306040-00002/ });
  await expect(doi).toBeVisible();
  await expect(doi).toHaveAttribute("href", "https://doi.org/10.7326/0003-4819-158-11-201306040-00002");
  // click anywhere outside the card (inside the modal): the side margin the card does not cover
  const pop = await doi.evaluate((el) => {
    const r = (el.closest("[popover]") ?? el).getBoundingClientRect();
    return { left: r.left, top: r.top, width: window.innerWidth, height: window.innerHeight };
  });
  const fbox = (await iframe.boundingBox())!;
  const outsideX = pop.left > 40 ? 12 : pop.width - 12;
  await page.mouse.click(fbox.x + outsideX, fbox.y + Math.min(Math.max(pop.top + 40, 40), pop.height - 40));
  await expect(doi).toBeHidden();
  await expect(iframe).toBeVisible();

  // 6. The measured line (+20 yrs is the default horizon)
  await expect(f.getByText("Read by AI Skin Analysis", { exact: true })).toBeVisible();
  await expect(f.getByRole("heading", { name: "The measured line" })).toBeVisible();
  await expect(f.getByText("Higher = better-looking skin", { exact: true })).toBeVisible();
  for (const [key, a, b] of [
    ["wrinkle", "71.2", "79.1"],
    ["texture", "91.4", "97.5"],
    ["spots", "96.4", "98.8"],
  ]) {
    await expect(f.getByTestId(`measured-${key}-now`)).toHaveText(a);
    await expect(f.getByTestId(`measured-${key}-spf`)).toHaveText(b);
  }

  // 7. Change the horizon
  const wrinkleRow = f.locator("li").filter({ has: f.getByTestId("measured-wrinkle-now") });
  await f.getByRole("button", { name: "+10 yrs", exact: true }).click();
  await expect(now).toHaveAttribute("src", /now-10\.jpg/);
  await expect(wrinkleRow).toContainText("+6.4");
  await f.getByRole("button", { name: "+20 yrs", exact: true }).click();
  await expect(now).toHaveAttribute("src", /now-20\.jpg/);
  await expect(wrinkleRow).toContainText("+7.9");

  // 8. UV where you live
  const uv = f.locator("article").filter({ hasText: "UV today" });
  await expect(uv.getByText("7.8", { exact: true })).toBeVisible();
  await expect(uv.getByText("High UV", { exact: true })).toBeVisible();
  await expect(uv.getByRole("heading", { name: "Nambour, Australia" })).toBeVisible();
  await expect(uv.getByText("Weather data by Open-Meteo.com · CC BY 4.0")).toBeVisible();

  // 9. The routine with this product
  await f.getByRole("button", { name: "Build my SPF routine" }).click();
  await expect(f.getByRole("heading", { name: "Your routine for UV 7.8" })).toBeInViewport();
  const steps = f.getByTestId("routine-step");
  await expect(steps).toHaveCount(3);
  for (const [i, l] of ["Morning", "Midday top-up", "Evening"].entries()) {
    await expect(steps.nth(i).getByText(l, { exact: true })).toBeVisible();
  }
  const morning = steps.nth(0);
  await expect(morning).toHaveAttribute("data-code", product.code);
  await expect(morning.getByText(product.name, { exact: true })).toBeVisible();
  await expect(morning.getByText("SPF 50 covers a UV 7.8 day", { exact: true })).toBeVisible();
  await expect(morning.getByRole("link", { name: /View on Open Beauty Facts/ })).toBeVisible();

  // 10. Save and back to the store
  await settle(f);
  const save = steps.nth(1).getByRole("button", { name: /^Save / });
  await save.click();
  await expect(save).toContainText("Saved");
  const list = f.getByTestId("bag").filter({ visible: true });
  await expect(list.getByRole("heading", { name: "Your routine" })).toBeVisible();
  await expect(list.getByTestId("bag-count")).toHaveText("1 item");
  await page.screenshot({ path: "test-results/demo-end.png", animations: "disabled" });
  await f.getByRole("button", { name: "Close Future Face" }).click();
  await expect(iframe).toHaveCount(0);
  await expect(pill).toBeFocused();

  expect(errors).toEqual([]);
});

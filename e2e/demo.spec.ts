import { mkdirSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";

// Walks docs/DEMO.md steps 1-10 in order. Every label below is typed out as the script writes it
// (not imported from lib/copy), so a copy change that breaks the demo script fails here.

mkdirSync("test-results", { recursive: true });

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

const settle = async (page: Page) => {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
};

const clipOf = (img: Locator) => img.evaluate((el) => getComputedStyle(el).clipPath);

test.use({ viewport: { width: 1440, height: 900 } });

test("demo script: steps 1 to 10 of docs/DEMO.md run end to end", async ({ page }) => {
  const errors = collectErrors(page);

  // 1. Landing
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Meet yourself at 45. Twice.");
  await expect(page.getByText("YouCam Skin AI", { exact: true })).toBeVisible();

  // 2. How it works
  await page.getByRole("link", { name: "How it works", exact: true }).click();
  const how = page.locator("#how");
  for (const api of ["AI Aging Generator", "AI Skin Simulation", "AI Skin Analysis"]) {
    await expect(how.getByText(api, { exact: true })).toBeInViewport();
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));

  // 3. Open the result
  await page.getByRole("link", { name: "See your two futures" }).click();
  await expect(page).toHaveURL(/\/result$/);
  const now = page.getByTestId("face-now");
  const spf = page.getByTestId("face-spf");
  await expectLoaded(now);
  await expectLoaded(spf);
  const main = page.locator("main");
  await expect(main.getByText("Demo face", { exact: true })).toBeVisible();
  // "Age read today" and "38" are two sibling spans, so they are asserted as one block of text.
  await expect(main.getByText("Age read today", { exact: true })).toBeVisible();
  await expect(main.getByText("Age read today").locator("..")).toHaveText(/Age read today\s*38/);
  await expect(main.getByText("Nambour · UV 7.8", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("You at 58. Twice.");
  await expect(page.getByText(/picked res_age 58 for target 58/)).toBeVisible();
  await settle(page);

  // 4. The slider: a real mouse drag across the face
  const slider = page.getByRole("slider", { name: "Divider between the two futures" });
  const box = (await slider.boundingBox())!;
  const y = box.y + box.height / 2;
  await expect(slider).toBeInViewport();
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
  await expect(page.getByText("Illustrative projection, not a prognosis.", { exact: true })).toBeVisible();
  // the two tag names the script points between
  const frame = page.locator("figure").filter({ has: slider });
  await expect(frame.getByText("As you live now").first()).toBeVisible();
  await expect(frame.getByText("With daily SPF").first()).toBeVisible();

  // 5. Where 0.24 comes from
  const chip = page.getByRole("button", { name: "Source, Wrinkles 0.24" });
  await chip.evaluate((el) => {
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 120, behavior: "instant" });
  });
  await chip.click();
  // each row carries its own (hidden) popover; only the one that opened is visible
  await expect(page.getByText("Why this intensity · 0.24").filter({ visible: true })).toHaveCount(1);
  await expect(page.locator("[popover]:popover-open").getByText("Why this intensity · 0.24")).toBeVisible();
  const doi = page.getByRole("link", { name: /10\.7326\/0003-4819-158-11-201306040-00002/ });
  await expect(doi).toBeVisible();
  await expect(doi).toHaveAttribute("href", "https://doi.org/10.7326/0003-4819-158-11-201306040-00002");
  await expect(page.getByText(/Hughes MCB/).first()).toBeVisible();
  // click anywhere outside the card: pick whichever side margin the card does not cover
  const pop = (await doi.evaluate((el) => {
    const r = (el.closest("[popover]") ?? el).getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  }));
  const outsideX = pop.left > 40 ? 12 : 1428;
  await page.mouse.click(outsideX, Math.min(Math.max(pop.top + 40, 40), 860));
  await expect(doi).toBeHidden();

  // 6. The measured line (+20 yrs is the default horizon)
  await expect(page.getByText("Read by AI Skin Analysis", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The measured line" })).toBeVisible();
  await expect(page.getByText("Higher = better-looking skin", { exact: true })).toBeVisible();
  const numbers: Array<[string, string, string]> = [
    ["wrinkle", "71.2", "79.1"],
    ["texture", "91.4", "97.5"],
    ["spots", "96.4", "98.8"],
  ];
  for (const [key, a, b] of numbers) {
    await expect(page.getByTestId(`measured-${key}-now`)).toHaveText(a);
    await expect(page.getByTestId(`measured-${key}-spf`)).toHaveText(b);
  }

  // 7. Change the horizon
  const wrinkleRow = page.locator("li").filter({ has: page.getByTestId("measured-wrinkle-now") });
  await page.getByRole("button", { name: "+10 yrs", exact: true }).click();
  await expect(page.getByRole("button", { name: "+10 yrs", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(now).toHaveAttribute("src", /now-10\.jpg/);
  await expect(wrinkleRow).toContainText("+6.4");
  await page.getByRole("button", { name: "+20 yrs", exact: true }).click();
  await expect(page.getByRole("button", { name: "+20 yrs", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(now).toHaveAttribute("src", /now-20\.jpg/);
  await expect(wrinkleRow).toContainText("+7.9");

  // 8. UV where you live
  const uv = page.locator("article").filter({ hasText: "UV today" });
  await expect(uv.getByText("UV today", { exact: true })).toBeVisible();
  await expect(uv.getByText("7.8", { exact: true })).toBeVisible();
  await expect(uv.getByText("High UV", { exact: true })).toBeVisible();
  await expect(uv.getByRole("heading", { name: "Nambour, Australia" })).toBeVisible();
  await expect(uv.getByText("Weather data by Open-Meteo.com · CC BY 4.0")).toBeVisible();

  // 9. Build the routine
  await page.getByRole("button", { name: "Build my SPF routine" }).click();
  const heading = page.getByRole("heading", { name: "Your routine for UV 7.8" });
  await expect(heading).toBeInViewport();
  const steps = page.getByTestId("routine-step");
  await expect(steps).toHaveCount(3);
  for (const [i, label] of ["Morning", "Midday top-up", "Evening"].entries()) {
    await expect(steps.nth(i).getByText(label, { exact: true })).toBeVisible();
  }

  // 10. Bag and checkout
  await settle(page);
  const addNoon = page.getByRole("button", { name: "Add Noon Fluid SPF 50" });
  const addGlide = page.getByRole("button", { name: "Add Glide Stick SPF 50" });
  await addNoon.click();
  await addGlide.click();
  await expect(addNoon).toContainText("Added");
  await expect(addGlide).toContainText("Added");
  const bag = page.getByTestId("bag").filter({ visible: true });
  await expect(bag.getByRole("heading", { name: "Your bag" })).toBeVisible();
  await expect(bag.getByTestId("bag-count")).toHaveText("2 items");
  await expect(bag.getByText("Subtotal", { exact: true })).toBeVisible();
  await expect(bag.getByTestId("bag-subtotal")).toHaveText("€54");
  await bag.getByRole("button", { name: "Checkout" }).click();
  await expect(
    bag.getByText("This is a demo store, so no order was placed and nothing was charged. The products are fictional."),
  ).toBeVisible();

  await settle(page);
  await page.screenshot({ path: "test-results/demo-end.png", animations: "disabled" });
  expect(errors).toEqual([]);
});

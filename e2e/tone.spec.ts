import { mkdirSync, readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { landing, result as copy, routine as rc } from "../lib/copy";
import type { FaceId } from "../lib/fixtures";
import { demoResult } from "../lib/pipeline";
import type { Product } from "../lib/products";
import { routineFor, type Concerns } from "../lib/routine";
import { TONE_ASSUMPTION, TONE_CITATIONS } from "../lib/tone";

// F17: the skin tone step on the dose card, and the routine that follows the weakest model reading.

mkdirSync("test-results", { recursive: true });

const catalogue = JSON.parse(readFileSync("fixtures/products.json", "utf8")).products as Product[];

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
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
};

/** The raw "as you live now" readings of one horizon, as the result passes them to routineFor. */
const concernsOf = (face: FaceId, years: number): Concerns => {
  const h = demoResult(undefined, face).horizons.find((x) => x.years === years)!;
  return Object.fromEntries(h.measured.map((m) => [m.key, m.now])) as Concerns;
};

// What the recorded tones must show at the recorded Nambour UV (ratio 1).
const FACES = [
  { face: "a", url: "/result", years: 30, band: "brown", factor: "×0.5", ita: "−6.2°", ratio: "0.5", intensity: "0.12", spf: /spf-30-012\.jpg/ },
  { face: "b", url: "/result?face=b", years: 20, band: "intermediate", factor: "×0.75", ita: "30.2°", ratio: "1.0", intensity: "0.24", spf: /spf-20-024\.jpg/ },
] as const;

for (const f of FACES) {
  test(`face ${f.face}: the dose card shows the measured skin tone and doses from it`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(f.url);
    const main = page.locator("main");
    const dose = main.getByTestId("dose");
    await dose.scrollIntoViewIfNeeded();
    await expect(dose).toBeVisible();

    // the data agrees with what the card must say
    const d = demoResult(undefined, f.face).dose;
    expect(d.tone?.band).toBe(f.band);
    expect(d.intensity.toFixed(2)).toBe(f.intensity);

    const tile = dose.getByTestId("dose-tone");
    await expect(tile).toBeVisible();
    await expect(tile.getByTestId("dose-tone-band")).toHaveText(copy.dose.bands[f.band]);
    expect(copy.dose.bands[f.band]).toMatch(new RegExp(f.band));
    await expect(tile.getByTestId("dose-tone-factor")).toHaveText(f.factor);
    await expect(tile.getByTestId("dose-tone-ita")).toHaveText(`ITA ${f.ita}`);
    await expect(tile.getByTestId("dose-tone-swatch")).toBeVisible();

    // 0.24 x (UV ratio x tone factor, rounded to the nearest 0.5) = intensity
    await expect(dose.getByTestId("dose-trial")).toHaveText("0.24");
    await expect(dose.getByTestId("dose-uv-ratio")).toHaveText("1.0");
    await expect(dose.getByTestId("dose-factor")).toHaveText(f.factor.slice(1));
    await expect(dose.getByTestId("dose-ratio")).toHaveText(f.ratio);
    await expect(dose.getByTestId("dose-intensity")).toHaveText(f.intensity);
    await expect(page.getByTestId("face-spf")).toHaveAttribute("src", f.spf);

    // the three sources, and the factor table stated as an assumption
    await expect(dose.getByRole("link", { name: /Hughes 2013/ })).toBeVisible();
    for (const [name, c] of [
      [/Chardon 1991/, TONE_CITATIONS.chardon],
      [/Kaidbey 1979/, TONE_CITATIONS.kaidbey],
    ] as const) {
      const link = dose.getByRole("link", { name });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", `https://doi.org/${c.doi}`);
      await expect(link).toHaveAttribute("target", "_blank");
    }
    await expect(dose.getByText(TONE_ASSUMPTION, { exact: true })).toBeVisible();
    expect(await main.innerText()).not.toMatch(/NaN|undefined/);
    expect(errors).toEqual([]);
  });

  test(`face ${f.face}: the visible formula and the screen-reader sentence say the same rounding`, async ({ page }) => {
    await page.goto(f.url);
    const dose = page.locator("main").getByTestId("dose");
    await expect(dose.getByTestId("dose-rounded-label")).toHaveText(copy.dose.rounded);
    const sentence = (await dose.getByTestId("dose-sentence").textContent())!;
    // one rounding phrase, the same words as the visible label, followed by the same value the formula shows
    expect(sentence.match(/rounded/g)).toHaveLength(1);
    expect(sentence).toContain(`${copy.dose.rounded}: ${f.ratio}`);
    expect(sentence).toContain(`${copy.dose.bands[f.band]}`);
    expect(sentence).toContain(f.factor.slice(1));
    expect(sentence).toContain(`ITA ${f.ita}`);
    expect(sentence).toMatch(new RegExp(`= ${f.intensity.replace(".", "\\.")}$`));
  });

  test(`face ${f.face}: at 390 px the dose card fits its column`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(f.url);
    await settle(page);
    const dose = page.locator("main").getByTestId("dose");
    await dose.scrollIntoViewIfNeeded();
    const fit = await dose.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const card = el.closest("figure")!.getBoundingClientRect();
      const kids = [...el.querySelectorAll("*")].map((k) => k.getBoundingClientRect()).filter((r) => r.width > 0);
      return {
        scroll: el.scrollWidth - el.clientWidth,
        inCard: box.left >= card.left && box.right <= card.right + 0.5,
        kidsOut: kids.filter((r) => r.left < box.left - 0.5 || r.right > box.right + 0.5).length,
      };
    });
    expect(fit).toEqual({ scroll: 0, inCard: true, kidsOut: 0 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    await dose.screenshot({ path: `test-results/tone-dose-${f.face}-390.png`, animations: "disabled" });
  });
}

async function openRoutine(page: Page) {
  await page.locator("main").getByRole("button", { name: rc.cta }).click();
  return page.getByRole("region", { name: new RegExp(rc.titlePrefix) });
}

const morningOf = (section: Locator) => section.locator('[data-testid="routine-step"][data-step="morning"]');
const focusText = (concern: keyof typeof rc.focus) => `${rc.focusPrefix} ${rc.focus[concern]}, ${rc.focusSuffix}`;

// Readings are Skin Analysis raw_score, higher = better-looking skin, so the pick targets the LOWEST "now" reading.
// Fixture "now" readings: a +30 spots 63.4 / wrinkle 21.6 / texture 64.1; a +20 71 / 44.9 / 68.5; b +20 96.4 / 71.2 / 91.4.
test("the routine's morning pick follows the weakest reading of the shown horizon", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/result");
  const uv = demoResult(undefined, "a").uv!.uvMax;

  const section = await openRoutine(page);
  const morning = morningOf(section);
  const at30 = routineFor(uv, catalogue, null, concernsOf("a", 30));
  expect(at30.focus).toEqual({ concern: "wrinkle", score: 21.6 });
  expect(at30.steps[0].product.kind).toBe("cream");
  expect(at30.steps[0].why).toContain("Lines read weakest, so a cream.");
  await expect(morning).toHaveAttribute("data-code", at30.steps[0].product.code);
  await expect(morning.getByTestId("focus-pill")).toHaveText("Picked for lines, your weakest reading");
  await expect(morning.getByText(at30.steps[0].why)).toBeVisible();
  await settle(page);
  await morning.screenshot({ path: "test-results/tone-routine-a30.png", animations: "disabled" });

  // the other horizon: its own readings, whose weakest is also lines (44.9), so the same cream
  await page.locator("main").getByRole("button", { name: landing.visual.horizon[0] }).click();
  const at20 = routineFor(uv, catalogue, null, concernsOf("a", 20));
  expect(at20.focus).toEqual({ concern: "wrinkle", score: 44.9 });
  await expect(morning).toHaveAttribute("data-code", at20.steps[0].product.code);
  await expect(morning.getByTestId("focus-pill")).toHaveText(focusText(at20.focus!.concern));
  await expect(morning.getByText(at20.steps[0].why)).toBeVisible();
  // only the morning step carries the focus
  await expect(section.getByTestId("focus-pill")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("face b's routine follows its own readings", async ({ page }) => {
  await page.goto("/result?face=b");
  const uv = demoResult(undefined, "b").uv!.uvMax;
  const r = routineFor(uv, catalogue, null, concernsOf("b", 20));
  expect(r.focus).toEqual({ concern: "wrinkle", score: 71.2 });
  expect(r.steps[0].product.kind).toBe("cream");
  const morning = morningOf(await openRoutine(page));
  await expect(morning).toHaveAttribute("data-code", r.steps[0].product.code);
  await expect(morning.getByTestId("focus-pill")).toHaveText("Picked for lines, your weakest reading");
  await expect(morning.getByText(r.steps[0].why)).toBeVisible();
});

// The focus pill and the store-pick fit pill are tags for the product: at most 2 lines, inside the card,
// above "Why this step" (never down in the action row).
const preferCode = () => {
  const uv = demoResult(undefined, "a").uv!.uvMax;
  const concernPick = routineFor(uv, catalogue, null, concernsOf("a", 30)).steps[0].product.code;
  return catalogue.find((p) => p.spf !== null && p.kind !== "cleanser" && p.code !== concernPick)!.code;
};
for (const pill of ["focus-pill", "fit-pill"] as const) {
  for (const width of [390, 768, 1440]) {
    test(`at ${width} px the ${pill} sits above "Why this step" in at most 2 lines`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(pill === "focus-pill" ? "/result" : `/result?product=${preferCode()}`);
      const section = pill === "focus-pill" ? await openRoutine(page) : page.getByRole("region", { name: new RegExp(rc.titlePrefix) });
      const morning = morningOf(section);
      await morning.scrollIntoViewIfNeeded();
      await settle(page);
      const tag = morning.getByTestId(pill);
      await expect(tag).toBeVisible();
      const box = (await tag.boundingBox())!;
      const why = (await morning.getByText(rc.why, { exact: true }).boundingBox())!;
      const card = (await morning.boundingBox())!;
      expect(box.height).toBeLessThan(48);
      expect(box.y + box.height).toBeLessThanOrEqual(why.y);
      expect(box.x).toBeGreaterThanOrEqual(card.x);
      expect(box.x + box.width).toBeLessThanOrEqual(card.x + card.width);
      await morning.screenshot({ path: `test-results/tone-routine-${pill}-${width}.png`, animations: "disabled" });
    });
  }
}

test("a product picked in the store still wins over the weakest reading, with no focus pill", async ({ page }) => {
  const uv = demoResult(undefined, "a").uv!.uvMax;
  const concernPick = routineFor(uv, catalogue, null, concernsOf("a", 30)).steps[0].product.code;
  // any sunscreen the concern would not have picked
  const prefer = catalogue.find((p) => p.spf !== null && p.kind !== "cleanser" && p.code !== concernPick)!;
  await page.goto(`/result?product=${prefer.code}`);
  const section = page.getByRole("region", { name: new RegExp(rc.titlePrefix) });
  const morning = morningOf(section);
  await expect(morning).toHaveAttribute("data-code", prefer.code);
  await expect(section.getByTestId("focus-pill")).toHaveCount(0);
});

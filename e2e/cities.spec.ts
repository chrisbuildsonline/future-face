import { mkdirSync } from "node:fs";
import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
import { landing, result as copy, upload } from "../lib/copy";
import { demoResult, type FutureResult } from "../lib/pipeline";
import { recordedUv, type Uv } from "../lib/uv";

// F18: one-tap city chips on a demo result. Live UV changes daily, so the browser's city requests are stubbed with
// the real demo result for that face at a fixed UV (demoResult runs the same spfDose and picks the same recorded render).

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

const live = (city: string, country: string, uvMax: number): Uv => ({ ...recordedUv(), city, country, uvMax, date: "2026-10-31", source: "live" });
// Face b (tone x0.75) at Nambour 7.8 is ratio 1.0, 0.24. Lima 9.95: 1.28 x 0.75 = 0.96 -> 1.0, the same step.
// London 1.0: 0.13 x 0.75 = 0.10 -> clamped to 0.5, 0.12: the step moves down and the SPF render with it.
const stubs: Record<string, Uv> = {
  Lima: live("Lima", "Peru", 9.95),
  London: live("London", "United Kingdom", 1.0),
};

type Seen = { face: string | null; city: string | null };

/** Fulfils GET /api/future?city=... from the stubs; any other city fails with a 503 (the error path). */
async function stubCities(page: Page, seen: Seen[] = [], hold?: Promise<void>) {
  await page.route(
    (url) => url.pathname === "/api/future" && url.searchParams.has("city"),
    async (route: Route) => {
      const url = new URL(route.request().url());
      const face = url.searchParams.get("face");
      const city = url.searchParams.get("city");
      seen.push({ face, city });
      if (hold) await hold;
      const uv = city ? stubs[city] : undefined;
      if (!uv) return route.fulfill({ status: 503, json: { error: { kind: "unknown", message: "down" } } });
      return route.fulfill({ json: demoResult(uv, face === "b" ? "b" : "a") });
    },
  );
  return seen;
}

const nambourB = demoResult(undefined, "b");
const limaB = demoResult(stubs.Lima, "b");
const londonB = demoResult(stubs.London, "b");

const viewports = [
  { name: "1440", width: 1440, height: 900 },
  { name: "390", width: 390, height: 844 },
] as const;

for (const vp of viewports) {
  test.describe(`city chips at ${vp.width}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("tapping a city re-reads the dose for face b and says what moved", async ({ page }) => {
      const errors = collectErrors(page);
      const seen = await stubCities(page);
      await page.goto("/result?face=b");
      const main = page.locator("main");
      const group = main.getByRole("group", { name: copy.cities.label });
      const chip = (name: string) => group.getByRole("button", { name });
      const status = main.getByTestId("city-status");
      const spf = page.getByTestId("face-spf");
      const uvPill = main.getByTestId("uv-pill");

      // the recorded default: Nambour selected, the four cities beside it
      for (const name of ["Nambour", ...copy.cities.names]) await expect(chip(name)).toBeVisible();
      await expect(chip("Nambour")).toHaveAttribute("aria-pressed", "true");
      await expect(chip("Lima")).toHaveAttribute("aria-pressed", "false");
      await expect(status).toHaveAttribute("role", "status");
      await expect(status).toHaveText(copy.cities.hint);
      await expect(uvPill).toHaveText("Nambour · UV 7.8");
      await expect(page.getByTestId("dose-intensity")).toHaveText("0.24");
      await expect(spf).toHaveAttribute("src", nambourB.horizons[0].spf.image);
      await expectLoaded(spf);

      // face b has only +20 recorded: no +30 control at all, +20 as a static label
      await expect(main.getByRole("button", { name: landing.visual.horizon[1] })).toHaveCount(0);
      await expect(main.getByText(landing.visual.horizon[1], { exact: true })).toHaveCount(0);
      await expect(main.getByTestId("horizon-static")).toHaveText(landing.visual.horizon[0]);

      // Lima: UV 9.95, but face b's tone keeps it on the same step as Nambour, and the line says so
      expect(limaB.dose.intensity).toBe(nambourB.dose.intensity);
      await chip("Lima").click();
      await expect(status).toHaveText("Lima · UV 9.9 → same dose step (0.24)");
      await expect(chip("Lima")).toHaveAttribute("aria-pressed", "true");
      await expect(chip("Nambour")).toHaveAttribute("aria-pressed", "false");
      await expect(uvPill).toHaveText("Lima · UV 9.9");
      await expect(page.getByTestId("dose-city-uv")).toHaveText("9.9");
      await expect(page.getByTestId("dose-uv-ratio")).toHaveText(String(limaB.dose.uvRatio));
      await expect(page.getByTestId("dose-intensity")).toHaveText("0.24");
      await expect(main.getByRole("heading", { name: "Lima, Peru" })).toBeVisible();
      await expect(spf).toHaveAttribute("src", limaB.horizons[0].spf.image);
      expect(seen).toEqual([{ face: "b", city: "Lima" }]);

      // London: UV 1.0 drops the step to 0.12; the dose card, the SPF render and the readings all follow
      await chip("London").click();
      await expect(status).toHaveText("London · UV 1.0 → dose 0.12");
      await expect(uvPill).toHaveText("London · UV 1.0");
      await expect(page.getByTestId("dose-city-uv")).toHaveText("1.0");
      await expect(page.getByTestId("dose-ratio")).toHaveText("0.5");
      await expect(page.getByTestId("dose-intensity")).toHaveText("0.12");
      await expect(spf).toHaveAttribute("src", londonB.horizons[0].spf.image);
      expect(londonB.horizons[0].spf.image).not.toBe(limaB.horizons[0].spf.image);
      await expectLoaded(spf);
      const wrinkle = londonB.horizons[0].measured.find((m) => m.key === "wrinkle")!;
      await expect(page.getByTestId("measured-wrinkle-spf")).toHaveText(wrinkle.spf.toFixed(1));
      await expect(main.getByRole("heading", { name: "London, United Kingdom" })).toBeVisible();
      await expect(main.getByTestId("horizon-static")).toHaveText(landing.visual.horizon[0]);

      // back to the recorded default: no request, the recorded reading again
      await chip("Nambour").click();
      await expect(status).toHaveText("Nambour · UV 7.8 → dose 0.24");
      await expect(uvPill).toHaveText("Nambour · UV 7.8");
      await expect(spf).toHaveAttribute("src", nambourB.horizons[0].spf.image);
      expect(seen).toHaveLength(2);
      await expect(main.getByRole("heading", { name: "Nambour, Australia" })).toBeVisible();

      await chip("London").click();
      await expect(status).toHaveText("London · UV 1.0 → dose 0.12");
      expect(await main.innerText()).not.toMatch(/NaN|undefined/);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
      expect(await noOverflow(page)).toBe(0);
      await expectLoaded(spf);
      await page.screenshot({ path: `docs/screenshots/cities-${vp.name}.png`, animations: "disabled" });
      await chip("London").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `docs/screenshots/cities-chips-${vp.name}.png`, animations: "disabled" });

      expect(errors).toEqual([]);
    });
  });
}

test("while a city loads the old result stays and the chip is busy; a failed city keeps it too", async ({ page }) => {
  const errors = collectErrors(page);
  let release = () => {};
  const hold = new Promise<void>((r) => (release = r));
  await stubCities(page, [], hold);
  await page.goto("/result?face=b");
  const main = page.locator("main");
  const group = main.getByRole("group", { name: copy.cities.label });
  const spf = page.getByTestId("face-spf");
  await expectLoaded(spf);
  const before = await main.boundingBox();

  await group.getByRole("button", { name: "London" }).click();
  await expect(group.getByRole("button", { name: "London" })).toHaveAttribute("aria-busy", "true");
  // still the Nambour result, same box, nothing gone
  await expect(page.getByTestId("dose-intensity")).toHaveText("0.24");
  await expect(main.getByTestId("uv-pill")).toHaveText("Nambour · UV 7.8");
  await expect(spf).toHaveAttribute("src", nambourB.horizons[0].spf.image);
  expect((await main.boundingBox())?.height).toBe(before?.height);
  release();
  await expect(page.getByTestId("dose-intensity")).toHaveText("0.12");
  await expect(group.getByRole("button", { name: "London" })).not.toHaveAttribute("aria-busy", /.+/);

  // Dubai is not stubbed: the route fails, London stays, one short inline error
  await group.getByRole("button", { name: "Dubai" }).click();
  await expect(main.getByRole("alert")).toHaveText(copy.cities.error);
  await expect(page.getByTestId("dose-intensity")).toHaveText("0.12");
  await expect(main.getByTestId("uv-pill")).toHaveText("London · UV 1.0");
  await expect(group.getByRole("button", { name: "London" })).toHaveAttribute("aria-pressed", "true");
  await expect(group.getByRole("button", { name: "Dubai" })).toHaveAttribute("aria-pressed", "false");
  await expect(spf).toHaveAttribute("src", londonB.horizons[0].spf.image);

  // the next good tap clears it
  await group.getByRole("button", { name: "Lima" }).click();
  await expect(page.getByTestId("dose-intensity")).toHaveText("0.24");
  await expect(main.getByRole("alert")).toHaveCount(0);
  // the failed fetch logs a 503 resource error in the console: that one is expected
  expect(errors.filter((e) => !/503/.test(e))).toEqual([]);
});

test("face a keeps its horizon across a city and stays on the smallest step", async ({ page }) => {
  const errors = collectErrors(page);
  await stubCities(page);
  await page.goto("/result");
  const main = page.locator("main");
  const twenty = main.getByRole("button", { name: landing.visual.horizon[0] });
  await twenty.click();
  await expect(twenty).toHaveAttribute("aria-pressed", "true");
  await main.getByRole("group", { name: copy.cities.label }).getByRole("button", { name: "Lima" }).click();
  // face a's tone (x0.5): 1.28 x 0.5 = 0.64 -> 0.5, still 0.12
  await expect(main.getByTestId("city-status")).toHaveText("Lima · UV 9.9 → same dose step (0.12)");
  await expect(twenty).toHaveAttribute("aria-pressed", "true");
  await expect(main.getByRole("heading", { level: 1 })).toContainText("20");
  await expect(page.getByTestId("face-spf")).toHaveAttribute("src", demoResult(stubs.Lima, "a").horizons.find((h) => h.years === 20)!.spf.image);
  expect(errors).toEqual([]);
});

test("the chips work in the store widget's demo fallback", async ({ page }) => {
  const errors = collectErrors(page);
  await stubCities(page);
  await page.goto("/result?embed=1&face=b");
  const fallback = page.getByRole("region", { name: "Or see it on our demo face" });
  await fallback.getByRole("group", { name: copy.cities.label }).getByRole("button", { name: "London" }).click();
  await expect(fallback.getByTestId("city-status")).toHaveText("London · UV 1.0 → dose 0.12");
  await expect(fallback.getByTestId("face-spf")).toHaveAttribute("src", londonB.horizons[0].spf.image);
  expect(errors).toEqual([]);
});

test("a result from the visitor's own selfie has no city chips", async ({ page }) => {
  const errors = collectErrors(page);
  await page.route("**/api/future", (route) =>
    route.request().method() === "POST" ? route.fulfill({ json: { ...demoResult(), source: "live" } satisfies FutureResult }) : route.continue(),
  );
  await page.goto("/");
  await page.getByLabel(upload.city).fill("Lisbon");
  await page.getByLabel(upload.file).setInputFiles("fixtures/demo/input.jpg");
  await page.getByRole("button", { name: upload.submit }).click();
  await expectLoaded(page.getByTestId("face-now"));
  await expect(page.getByRole("group", { name: copy.cities.label })).toHaveCount(0);
  await expect(page.getByTestId("city-status")).toHaveCount(0);
  expect(errors).toEqual([]);
});

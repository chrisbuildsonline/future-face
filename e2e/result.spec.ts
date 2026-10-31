import { mkdirSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { errors as errorCopy, landing, result as copy, routine as rc, upload } from "../lib/copy";
import { CITATION } from "../lib/evidence";
import { demoResult } from "../lib/pipeline";
import { recordedUv, type Uv } from "../lib/uv";

mkdirSync("docs/screenshots", { recursive: true });

function collectErrors(page: Page, ignore: RegExp[] = []) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && !ignore.some((re) => re.test(msg.text()))) errors.push(`console: ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

async function expectLoaded(img: Locator) {
  await expect(img).toBeVisible();
  await expect
    .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0))
    .toBe(true);
}

const clipOf = (img: Locator) => img.evaluate((el) => getComputedStyle(el).clipPath);
const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("one click on the landing CTA opens the demo result with both faces loaded", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await page.getByRole("link", { name: landing.hero.cta }).click();
  await expect(page).toHaveURL(/\/result$/);

  await expectLoaded(page.getByTestId("face-now"));
  await expectLoaded(page.getByTestId("face-spf"));
  await expect(page.getByText(/illustrative projection, not a prognosis/i).first()).toBeVisible();

  const meteo = page.getByRole("link", { name: copy.uv.attribution });
  await expect(meteo).toBeVisible();
  await expect(meteo).toHaveAttribute("href", copy.uv.attributionUrl);

  expect(errors).toEqual([]);
});

test("moving the slider moves the clip on the SPF face", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/result");
  const spf = page.getByTestId("face-spf");
  await expectLoaded(spf);

  const slider = page.getByRole("slider", { name: copy.slider.label });
  await slider.focus();
  await page.keyboard.press("End");
  await expect(slider).toHaveValue("100");
  await expect.poll(() => clipOf(spf)).toContain("100%");

  await page.keyboard.press("Home");
  await expect(slider).toHaveValue("0");
  const atZero = await clipOf(spf);
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => clipOf(spf)).not.toBe(atZero);

  expect(errors).toEqual([]);
});

test("the source chip opens the Hughes 2013 citation with its doi", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/result");
  await expect(page.getByText("0.24").first()).toBeVisible();

  const chip = page.getByRole("button", { name: new RegExp(copy.measured.source) }).first();
  // The ~470px popover fits neither above nor below a chip centred in a 720px viewport, which is where
  // Playwright's own scroll puts it; that made this test pass only when the click raced the smooth
  // scroll (7 of 8 runs failed at HEAD too). Let fonts and the entrance settle, then bring the chip near
  // the top first, as a reader would.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
  await chip.evaluate((el) => {
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 120, behavior: "instant" });
  });
  await chip.click();
  const doi = page.getByRole("link", { name: new RegExp(CITATION.doi.replace(/[.()]/g, "\\$&")) });
  await expect(doi).toBeVisible();
  await expect(doi).toHaveAttribute("href", `https://doi.org/${CITATION.doi}`);
  await expect(page.getByText(/Hughes MCB/).first()).toBeVisible();

  // the popover sits on screen, next to the chip that opened it
  const pop = await doi.evaluate((el) => {
    const r = (el.closest("[popover]") ?? el).getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  });
  const vw = page.viewportSize()!.width;
  expect(pop.left).toBeGreaterThanOrEqual(0);
  expect(pop.right).toBeLessThanOrEqual(vw);
  const chipBox = (await chip.boundingBox())!;
  expect(Math.min(Math.abs(pop.top - (chipBox.y + chipBox.height)), Math.abs(pop.bottom - chipBox.y))).toBeLessThan(80);
  await page.screenshot({ path: "docs/screenshots/citation.png", animations: "disabled" });

  await page.keyboard.press("Escape");
  await expect(doi).toBeHidden();
  expect(errors).toEqual([]);
});

test("the two default faces are different renders of one shared aging frame", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/result");
  const now = page.getByTestId("face-now");
  const spf = page.getByTestId("face-spf");
  await expectLoaded(now);
  await expectLoaded(spf);

  // +30 is the default horizon
  await expect(page.getByRole("button", { name: landing.visual.horizon[1] })).toHaveAttribute("aria-pressed", "true");
  const [nowSrc, spfSrc] = [await now.getAttribute("src"), await spf.getAttribute("src")];
  expect(nowSrc).toBeTruthy();
  expect(spfSrc).toBeTruthy();
  expect(nowSrc).not.toBe(spfSrc);

  // one caption for both faces: the same aging frame, 66 on the demo face at +30
  await expect(page.getByTestId("frame-age")).toHaveText(`${copy.frame.age} 66`);
  await expect(page.getByTestId("frame-age").locator("..")).toContainText(copy.frame.both);
  await expect(page.getByTestId("frame-now")).toHaveCount(0);
  await expect(page.getByTestId("frame-spf")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the dose formula shows both UV readings, where they come from, and the intensity", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/result");
  const dose = page.getByTestId("dose");
  await dose.scrollIntoViewIfNeeded();
  await expect(dose).toBeVisible();
  // the demo reads Nambour, the trial site, against itself: UV ratio 7.8 / 7.8 = 1.0, x the measured tone factor 0.5
  // (face a, ITA -6.2, brown) = 0.5, already on a 0.5 step; 0.24 x 0.5 = 0.12
  await expect(dose.getByTestId("dose-trial")).toHaveText("0.24");
  await expect(dose.getByTestId("dose-city-uv")).toHaveText("7.8");
  await expect(dose.getByTestId("dose-ref-uv")).toHaveText("7.8");
  await expect(dose.getByTestId("dose-ratio")).toHaveText("0.5");
  await expect(dose.getByTestId("dose-intensity")).toHaveText("0.12");
  await expect(dose).toContainText("Nambour");
  await expect(dose).toContainText(copy.dose.trialSite);
  await expect(dose.getByRole("link", { name: /Hughes 2013/ })).toHaveAttribute("href", `https://doi.org/${CITATION.doi}`);
  // the whole formula reads as one sentence to a screen reader
  await expect(page.getByTestId("dose-sentence")).toHaveText(
    /0\.24 × \(UV 7\.8 in Nambour \/ UV 7\.8 in Nambour, the trial site = 1\.0, × skin tone factor 0\.5 for brown skin, ITA −6\.2°, rounded to nearest 0\.5: 0\.5\) = 0\.12/,
  );
  expect(errors).toEqual([]);
});

test("the old method wording is gone from the landing and the result", async ({ page }) => {
  for (const url of ["/", "/result"]) {
    await page.goto(url);
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/fewer years|measured line|earlier frame|finishing pass/i);
  }
  expect(copy.measured.title).toMatch(/model reading/i);
  await expect(page.getByRole("heading", { name: copy.measured.title })).toBeVisible();
});

test("the horizon switch swaps both faces and the model readings", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/result");
  const now = page.getByTestId("face-now");
  const spf = page.getByTestId("face-spf");
  await expectLoaded(now);

  // +30 is the default: frame 66 for target 64, the SPF render at 0.12 (Nambour's own UV x tone factor 0.5 = 0.5; 0.24 x 0.5), wrinkles 21.6 -> 36.6 (the recorded 0.12 analysis)
  await expect(now).toHaveAttribute("src", /now-30\.jpg/);
  await expect(spf).toHaveAttribute("src", /spf-30-012\.jpg/);
  await expect(page.getByTestId("measured-wrinkle-now")).toHaveText("21.6");
  await expect(page.getByTestId("measured-wrinkle-spf")).toHaveText("36.6");
  await expect(page.getByText(`${copy.frame.target} 64.`)).toBeVisible();

  const twenty = page.getByRole("button", { name: landing.visual.horizon[0] });
  await twenty.click();
  await expect(twenty).toHaveAttribute("aria-pressed", "true");
  await expect(now).toHaveAttribute("src", /now-20\.jpg/);
  await expect(spf).toHaveAttribute("src", /spf-20-012\.jpg/);
  await expect(page.getByTestId("measured-wrinkle-now")).toHaveText("44.9");
  await expect(page.getByTestId("measured-wrinkle-spf")).toHaveText("56.2");
  await expect(page.getByTestId("frame-age")).toHaveText(`${copy.frame.age} 55`);
  await expect(page.getByText(`${copy.frame.target} 54.`)).toBeVisible();
  await expectLoaded(now);
  await expectLoaded(spf);

  expect(errors).toEqual([]);
});

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 },
] as const;

for (const vp of viewports) {
  test.describe(`result at ${vp.width}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("fits the width, shows the disclaimer and attribution, and saves a screenshot", async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto("/result");
      await expectLoaded(page.getByTestId("face-now"));
      await expectLoaded(page.getByTestId("face-spf"));
      for (const img of await page.getByTestId("closeup").all()) await expectLoaded(img);
      await expect(page.getByText(/illustrative projection, not a prognosis/i).first()).toBeVisible();
      await expect(page.getByRole("link", { name: copy.uv.attribution })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);

      expect(await noOverflow(page)).toBe(0);
      await page.screenshot({ path: `docs/screenshots/result-${vp.name}.png`, fullPage: true, animations: "disabled" });
      expect(errors).toEqual([]);
    });
  });
}

test.describe("phone: the sticky routine bar and the slider", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  // true when the bar is showing and its box overlaps the compare figure's box
  const covers = (page: Page) =>
    page.evaluate(() => {
      const bar = [...document.querySelectorAll("main button")].find((b) => b.textContent?.includes("Build my SPF routine"));
      const fig = document.querySelector("main figure:has([data-testid='face-spf'])");
      if (!bar || !fig) throw new Error("bar or figure missing");
      const st = getComputedStyle(bar);
      if (st.visibility === "hidden" || Number(st.opacity) < 0.05) return false;
      const a = bar.getBoundingClientRect();
      const b = fig.getBoundingClientRect();
      return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    });

  test("never covers the compare figure while it is in view, and shows once it has scrolled away", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/result");
    await expectLoaded(page.getByTestId("face-spf"));
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));

    const figure = page.locator("main figure").filter({ has: page.getByTestId("face-spf") });
    const { top, bottom } = await figure.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY };
    });
    // every scroll position while any of the figure is on screen
    for (let y = 0; y < bottom; y += 120) {
      await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
      await expect.poll(() => covers(page), { message: `bar covers the figure at scrollY ${y}` }).toBe(false);
    }
    expect(top).toBeGreaterThan(0);

    // past the figure: the bar is back in the thumb zone
    await page.evaluate((y) => window.scrollTo({ top: y + 40, behavior: "instant" }), bottom);
    const bar = page.getByRole("button", { name: rc.cta });
    await expect(bar).toBeVisible();
    await expect(bar).toBeInViewport();
    await expect.poll(() => bar.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    await bar.click();
    await expect(page.getByRole("heading", { name: new RegExp(rc.titlePrefix) })).toBeFocused();
    expect(errors).toEqual([]);
  });
});

test.describe("upload on the landing", () => {
  const selfie = "fixtures/demo/input.jpg";

  test("an API error is shown inline in a tinted pill", async ({ page }) => {
    // Chrome logs every non-2xx response; that one line is expected here.
    const errors = collectErrors(page, [/Failed to load resource/]);
    await page.route("**/api/future", (route) =>
      route.request().method() === "POST"
        ? route.fulfill({ status: 422, json: { error: { kind: "no_face", message: errorCopy.no_face } } })
        : route.continue(),
    );
    await page.goto("/");
    await page.getByLabel(upload.city).fill("Lisbon");
    await page.getByLabel(upload.file).setInputFiles(selfie);
    await page.getByRole("button", { name: upload.submit }).click();

    // Scoped to <main>: Next's app router always mounts its own empty role="alert" route announcer on <body>.
    const alert = page.locator("main").getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(errorCopy.no_face);
    await expect(alert.getByRole("link", { name: "See the demo face" })).toHaveAttribute("href", "/result");
    expect(errors).toEqual([]);
  });

  test("a run shows honest loading copy, then the result with its notice", async ({ page, request }) => {
    const errors = collectErrors(page);
    const demo = await (await request.get("/api/future")).json();
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    await page.route("**/api/future", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      const body = route.request().postDataBuffer();
      expect(body?.includes(Buffer.from('name="city"'))).toBe(true);
      await held;
      await route.fulfill({ json: { ...demo, notice: errorCopy.no_key } });
    });

    await page.goto("/");
    await page.getByLabel(upload.city).fill("Lisbon");
    await page.getByLabel(upload.file).setInputFiles(selfie);
    await page.getByRole("button", { name: upload.submit }).click();

    await expect(page.getByText(upload.loadingTitle)).toBeVisible();
    await expect(page.getByText(upload.loading)).toBeVisible();
    release();

    await expect(page.getByText(errorCopy.no_key)).toBeVisible();
    await expectLoaded(page.getByTestId("face-now"));
    await expectLoaded(page.getByTestId("face-spf"));
    await expect(page.getByText(upload.loadingTitle)).toBeHidden();
    expect(errors).toEqual([]);
  });

  // The client POSTs to /api/future and the server then calls Open-Meteo, which a page route cannot reach.
  // So the stub is exactly what the server answers without a key for that UV reading: demoResult(uv).
  test("two cities with different UV get different SPF renders of the same frame", async ({ page }) => {
    test.setTimeout(60_000); // two full uploads (MediaPipe crop each): 7-14s alone, past 30s under the full parallel suite
    const errors = collectErrors(page);
    const cities = [
      // face a's tone factor is 0.5. Oslo: 3.9 / 7.8 x 0.5 = 0.25, clamped up to 0.5, so 0.24 x 0.5 = 0.12.
      // Cairo: 11.7 / 7.8 x 0.5 = 0.75, nearest 0.5 step is 1.0, so 0.24 x 1.0 = 0.24.
      { city: "Oslo", country: "Norway", uvMax: 3.9, ratio: "0.5", intensity: "0.12", file: /spf-30-012\.jpg/ },
      { city: "Cairo", country: "Egypt", uvMax: 11.7, ratio: "1.0", intensity: "0.24", file: /spf-30-024\.jpg/ },
    ];
    const seen: { now: string | null; spf: string | null; frame: string | null }[] = [];
    for (const c of cities) {
      const uv: Uv = { ...recordedUv(), city: c.city, country: c.country, uvMax: c.uvMax, source: "live" };
      await page.unrouteAll();
      await page.route("**/api/future", (route) =>
        route.request().method() === "POST"
          ? route.fulfill({ json: { ...demoResult(uv), notice: errorCopy.no_key } })
          : route.continue(),
      );
      await page.goto("/");
      await page.getByLabel(upload.city).fill(c.city);
      await page.getByLabel(upload.file).setInputFiles(selfie);
      await page.getByRole("button", { name: upload.submit }).click();

      const now = page.getByTestId("face-now");
      const spf = page.getByTestId("face-spf");
      await expectLoaded(now);
      await expectLoaded(spf);
      await expect(spf).toHaveAttribute("src", c.file);
      const dose = page.getByTestId("dose");
      await expect(dose.getByTestId("dose-city-uv")).toHaveText(c.uvMax.toFixed(1));
      await expect(dose.getByTestId("dose-ref-uv")).toHaveText("7.8");
      await expect(dose.getByTestId("dose-ratio")).toHaveText(c.ratio);
      await expect(dose.getByTestId("dose-intensity")).toHaveText(c.intensity);
      await expect(dose).toContainText(c.city);
      seen.push({
        now: await now.getAttribute("src"),
        spf: await spf.getAttribute("src"),
        frame: await page.getByTestId("frame-age").textContent(),
      });
    }
    // same aging frame and the same "as you live now" render; only the SPF render follows the dose
    expect(seen[0].now).toBe(seen[1].now);
    expect(seen[0].frame).toBe(seen[1].frame);
    expect(seen[0].spf).not.toBe(seen[1].spf);
    expect(errors).toEqual([]);
  });
});

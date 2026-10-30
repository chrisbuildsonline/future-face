import { mkdirSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { errors as errorCopy, landing, result as copy, upload } from "../lib/copy";
import { CITATION } from "../lib/evidence";

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

test("the two default faces are different images with different frame ages", async ({ page }) => {
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

  // each face is captioned with its own aging frame: now 66, SPF 58 on the demo face
  const nowAge = page.getByTestId("frame-now");
  const spfAge = page.getByTestId("frame-spf");
  await expect(nowAge).toHaveText(`${copy.frame.age} 66`);
  await expect(spfAge).toHaveText(`${copy.frame.age} 58`);
  expect(await nowAge.textContent()).not.toBe(await spfAge.textContent());
  expect(errors).toEqual([]);
});

test("the horizon switch swaps both faces and the measured numbers", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/result");
  const now = page.getByTestId("face-now");
  const spf = page.getByTestId("face-spf");
  await expectLoaded(now);

  // +30 is the default: wrinkles 21.6 -> 61.0, frames 66 (now) and 58 (SPF) for target 64
  await expect(now).toHaveAttribute("src", /now-30\.jpg/);
  await expect(spf).toHaveAttribute("src", /spf-30\.jpg/);
  await expect(page.getByTestId("measured-wrinkle-now")).toHaveText("21.6");
  await expect(page.getByTestId("measured-wrinkle-spf")).toHaveText("61.0");
  await expect(page.getByText(`${copy.frame.target} 64.`)).toBeVisible();

  const twenty = page.getByRole("button", { name: landing.visual.horizon[0] });
  await twenty.click();
  await expect(twenty).toHaveAttribute("aria-pressed", "true");
  await expect(now).toHaveAttribute("src", /now-20\.jpg/);
  await expect(spf).toHaveAttribute("src", /spf-20\.jpg/);
  await expect(page.getByTestId("measured-wrinkle-now")).toHaveText("44.9");
  await expect(page.getByTestId("measured-wrinkle-spf")).toHaveText("78.6");
  await expect(page.getByTestId("frame-now")).toHaveText(`${copy.frame.age} 55`);
  await expect(page.getByTestId("frame-spf")).toHaveText(`${copy.frame.age} 51`);
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
    await expect(alert).toHaveText(errorCopy.no_face);
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

  test("when both arms share one aging frame, the measured card says so and shows no deltas", async ({ page, request }) => {
    const errors = collectErrors(page);
    const demo = await (await request.get("/api/future")).json();
    const last = demo.horizons[demo.horizons.length - 1];
    const same = { ...last, spfResAge: last.resAge, sameFrame: true, measured: [] };
    await page.route("**/api/future", (route) =>
      route.request().method() === "POST"
        ? route.fulfill({ json: { ...demo, horizons: [...demo.horizons.slice(0, -1), same] } })
        : route.continue(),
    );
    await page.goto("/");
    await page.getByLabel(upload.city).fill("Lisbon");
    await page.getByLabel(upload.file).setInputFiles(selfie);
    await page.getByRole("button", { name: upload.submit }).click();

    await expectLoaded(page.getByTestId("face-now"));
    await expect(page.getByTestId("same-frame")).toHaveText(copy.measured.sameFrame);
    await expect(page.getByTestId("measured-wrinkle-now")).toHaveCount(0);
    await expect(page.getByTestId("frame-now")).toHaveText(`${copy.frame.age} ${last.resAge}`);
    await expect(page.getByTestId("frame-spf")).toHaveText(`${copy.frame.age} ${last.resAge}`);

    // the other horizon still has two frames and its measured line
    await page.getByRole("button", { name: landing.visual.horizon[0] }).click();
    await expect(page.getByTestId("same-frame")).toHaveCount(0);
    await expect(page.getByTestId("measured-wrinkle-now")).toBeVisible();
    expect(errors).toEqual([]);
  });
});

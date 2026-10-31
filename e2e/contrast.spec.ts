import { expect, test, type Locator, type Page } from "@playwright/test";
import { landing, result as copy } from "../lib/copy";

// WCAG 2 contrast of small accent text against what it sits on: every one must reach 4.5:1.

const channels = (css: string) => (css.match(/[\d.]+/g) ?? []).map(Number);
const luminance = (css: string) => {
  const [r, g, b] = channels(css).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const wcag = (fg: string, bg: string) => {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
};

/** An element's text colour and the first opaque background behind it. */
const coloursOf = (el: Locator) =>
  el.evaluate((node) => {
    let bg = "rgb(255, 255, 255)";
    for (let n: Element | null = node; n; n = n.parentElement) {
      const c = getComputedStyle(n).backgroundColor;
      const alpha = c.startsWith("rgba") ? Number(c.split(",")[3]) : 1;
      if (alpha > 0.99) {
        bg = c;
        break;
      }
    }
    return { fg: getComputedStyle(node).color, bg };
  });

const tokenColours = (page: Page) =>
  page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--pill-accent-fg)";
    probe.style.backgroundColor = "var(--pill-accent-bg)";
    document.body.append(probe);
    const st = getComputedStyle(probe);
    const out = { fg: st.color, bg: st.backgroundColor };
    probe.remove();
    return out;
  });

async function expectReadable(el: Locator, what: string) {
  await expect(el).toBeVisible();
  const { fg, bg } = await coloursOf(el);
  expect(wcag(fg, bg), `${what}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
}

test("the accent pill tokens reach 4.5:1", async ({ page }) => {
  await page.goto("/");
  const { fg, bg } = await tokenColours(page);
  expect(wcag(fg, bg), `--pill-accent-fg ${fg} on --pill-accent-bg ${bg}`).toBeGreaterThanOrEqual(4.5);
});

test("accent text on the landing reaches 4.5:1", async ({ page }) => {
  await page.goto("/");
  await expectReadable(page.getByText(landing.nav.badge, { exact: true }), "nav badge pill");
  await expectReadable(page.getByText(landing.how.steps[0].api, { exact: true }), "step API pill");
  await expectReadable(page.getByRole("link", { name: landing.hero.ctaAlt }), "hero text link");
  await expectReadable(page.getByRole("link", { name: landing.how.citation.linkLabel }), "evidence link");
});

test("accent text on the result reaches 4.5:1", async ({ page }) => {
  await page.goto("/result");
  await expectReadable(page.getByText(copy.dose.api, { exact: true }).first(), "dose API pill");
  await expectReadable(page.getByRole("link", { name: new RegExp(copy.dose.cite) }), "dose citation link");
  await expectReadable(page.getByRole("button", { name: new RegExp(copy.measured.source) }).first(), "source chip");
  await expectReadable(page.getByText(copy.measured.eyebrow, { exact: true }), "model reading pill");
  await expectReadable(page.getByRole("link", { name: copy.uv.attribution }), "Open-Meteo link");
});

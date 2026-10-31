// Live check of the face crop: uploads e2e/fixtures/wide-selfie.jpg and prints what YouCam answered.
// SPENDS PAID YOUCAM UNITS when the app has a key. Usage: bun scripts/live-crop.ts [--url http://localhost:3100]
import { chromium } from "@playwright/test";
import { upload } from "../lib/copy";

const flag = process.argv.indexOf("--url");
const url = (flag > -1 && process.argv[flag + 1]) || "http://localhost:3100";

const browser = await chromium.launch();
let code = 1;
try {
  const page = await browser.newPage();
  await page.goto(url);
  await page.getByLabel(upload.city).fill("Lisbon");
  await page.getByLabel(upload.file).setInputFiles("e2e/fixtures/wide-selfie.jpg");
  await page.locator("main").getByRole("status").filter({ hasText: upload.cropDone }).waitFor({ timeout: 20_000 });

  const crop = await page.getByTestId("upload-preview").evaluate(async (el: HTMLImageElement) => {
    await el.decode();
    return `${el.naturalWidth}x${el.naturalHeight}`;
  });
  console.log(`crop ${crop}`);

  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/api/future") && r.request().method() === "POST", { timeout: 180_000 }),
    page.getByRole("button", { name: upload.submit }).click(),
  ]);
  const body = await res.json();
  if (body.error) {
    console.log(`error ${body.error.kind}: ${body.error.message}`);
  } else {
    console.log(`source ${body.source}`);
    if (body.notice) console.log(`notice ${body.notice}`);
    if (body.dose) console.log(`dose ${JSON.stringify(body.dose)} frames ${body.horizons.map((h: { years: number; resAge: number }) => `+${h.years}:${h.resAge}`).join(" ")}`);
    if (body.source === "live") code = 0;
  }
} finally {
  await browser.close();
}
process.exit(code);

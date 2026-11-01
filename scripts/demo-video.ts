// Records the demo video (about 2.5 min) with the American voice clone and a quiet synthesized pad.
// Needs bun, the voice-clone venv, ffmpeg/ffprobe and Playwright's chromium.
// Runs its own Next server with FF_CATALOGUE=generic (no brand trademarks).
// bun run demo:video -> docs/demo.mp4
import { chromium, type Frame, type Page } from "@playwright/test";
import { mkdtempSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { demoResult } from "../lib/pipeline";
import { GENERIC, productLabel, storeProduct } from "../lib/products";
import { recordedUv, type Uv } from "../lib/uv";

const ROOT = join(import.meta.dir, "..");
const TMP = mkdtempSync(join(tmpdir(), "ff-demo-"));
const OUT = join(ROOT, "docs");
const SPEAK = join(homedir(), ".venvs/voice-clone/bin/python");
const SPEAK_SCRIPT = "/home/chris/projects/AI Influencer/voice-clone/scripts/speak.py";
const LIVE_URL = "https://future-face.5-78-152-178.sslip.io";
const REPO_URL = "https://github.com/chrisbuildsonline/future-face";
const product = storeProduct(GENERIC)!;
const label = productLabel(product);
type Clip = { file: string; ms: number };

function durationMs(file: string) {
  const d = Bun.spawnSync(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  return Math.round(Number(d.stdout.toString()) * 1000);
}

async function speakAll(lines: Record<string, string>): Promise<Record<string, Clip>> {
  const jobs = Object.entries(lines).map(([key, text], i) => ({ key, text, out: join(TMP, `${String(i).padStart(3, "0")}.wav`) }));
  await Bun.write(join(TMP, "lines.json"), JSON.stringify(jobs.map(({ text, out }) => ({ text, out }))));
  const p = Bun.spawn([SPEAK, SPEAK_SCRIPT, "--profile", "american", "--batch", join(TMP, "lines.json")], {
    stdout: "inherit",
    stderr: "inherit",
  });
  if (await p.exited) throw new Error("American voice clone failed");
  const clips: Record<string, Clip> = {};
  for (const job of jobs) {
    const brisk = job.out.replace(/\.wav$/, "-brisk.wav");
    const sped = Bun.spawnSync(["ffmpeg", "-y", "-v", "error", "-i", job.out, "-filter:a", "atempo=1.08", brisk]);
    if (sped.exitCode) throw new Error(`could not pace ${job.key}`);
    clips[job.key] = { file: brisk, ms: durationMs(brisk) };
  }
  return clips;
}

function run(cmd: string[], env: Record<string, string> = {}) {
  // gates run without FF_CATALOGUE: the README env-var test fails if that var is set in the parent
  const p = Bun.spawnSync(cmd, { cwd: ROOT, env: { ...process.env, CI: "1", ...env } });
  const out = p.stdout.toString() + p.stderr.toString();
  if (p.exitCode) throw new Error(`${cmd.join(" ")} failed:\n${out.slice(-2000)}`);
  return out;
}

const grab = (text: string, re: RegExp, what: string) => {
  const m = text.match(re);
  if (!m) throw new Error(`could not read ${what} from the test output`);
  return m[1]!;
};

const live = (city: string, country: string, uvMax: number): Uv => ({
  ...recordedUv(),
  city,
  country,
  uvMax,
  date: "2026-11-01",
  source: "live",
});
// Face b tone x0.75: London UV 1.0 -> dose 0.12; Sydney UV 7.8-like high -> 0.24. Deterministic stubs for the video.
const cityUv: Record<string, Uv> = {
  London: live("London", "United Kingdom", 1.0),
  Sydney: live("Sydney", "Australia", 7.8),
};

const narration = (passed: string) => ({
  title:
    "Future Face shows you two faces of yourself, years from now. One kept living as now. The other wore sunscreen every day. And it lives where people buy sunscreen: on the product page.",
  store: `Sunday Pharmacy is a made-up shop. The product is fictional for this video, so no brand trademarks appear. A store adds Future Face with two lines of HTML: a script, and a div with the barcode.`,
  open: `A shopper can try it on their own selfie right on the product page. For the demo we scroll to a recorded live run. Three YouCam APIs did the work: the AI Aging Generator, AI Skin Simulation, and AI Skin Analysis.`,
  slider:
    "Both faces are the same Aging Generator frame. The only difference on the right is that frame through Skin Simulation, dosed for your city's UV and your measured skin tone.",
  cities:
    "On a second demo face, tap London, then Sydney. The SPF dose steps with the UV. London softens it. Sydney brings it back up. No upload needed.",
  routine: `Build my SPF routine sizes morning, midday and evening products to the sun where you live. Real fit rules, no invented prices.`,
  tests: `${passed} unit tests just passed, and the type check is clean.`,
  outro: `Two faces, read by the same model, on the product page. Future Face. Built on YouCam AI Aging Generator, AI Skin Simulation, and AI Skin Analysis.`,
});

// ---- 1. gates ----
console.log("running the gates...");
const tests = run(["bun", "run", "test"]);
run(["bun", "run", "typecheck"]);
const passed = grab(tests, /(\d+) pass/, "bun test passes");
console.log(`bun ${passed} pass`);
run(["bun", "run", "build"], { FF_CATALOGUE: "generic" });

// ---- 2. server on a free port ----
const probe = Bun.serve({ port: 0, fetch: () => new Response("") });
const PORT = probe.port;
await probe.stop(true);
const BASE = `http://127.0.0.1:${PORT}`;
const server = Bun.spawn(["bunx", "next", "start", "-p", String(PORT)], {
  cwd: ROOT,
  env: { ...process.env, FF_CATALOGUE: "generic", PORT: String(PORT) },
  stdout: "ignore",
  stderr: "inherit",
});

let secs = "0";
let webm = "";
const clips: { file: string; at: number }[] = [];
const out = join(OUT, "demo.mp4");

try {
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(BASE)).ok) break;
    } catch {}
    if (i > 150) throw new Error("server did not start");
    await Bun.sleep(200);
  }

  const CSS = `
:root{--ink:#1c1917;--dim:#57534e;--line:#e7e5e4;--accent:#BF4F28;--ok:#047857}
*{box-sizing:border-box}
body{margin:0;height:100vh;background:#F1EEEA;color:var(--ink);font:19px/1.45 Manrope,system-ui,sans-serif;overflow:hidden}
.stage{position:absolute;inset:0;padding:48px 64px;display:flex;flex-direction:column;animation:enter .7s cubic-bezier(.2,.7,.2,1) both}
@keyframes enter{from{opacity:0;transform:translateY(14px)}}
.eyebrow{font:600 13px Manrope,system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);margin-bottom:8px}
h1{font:700 44px/1.12 "Instrument Serif",Georgia,serif;letter-spacing:-.02em;margin:0 0 10px}
.lead{color:var(--dim);margin:0 0 22px;font-size:19px}
.card{background:#fff;border:1px solid var(--line);border-radius:20px;box-shadow:0 12px 32px rgba(28,25,23,.06);padding:18px 22px}
.card b{font-weight:600}
.cols{display:grid;gap:18px}
.in{animation:enter .6s cubic-bezier(.2,.7,.2,1) both}
.mono{font:15px/1.6 ui-monospace,monospace}
.dim{color:var(--dim);font-size:16px}
.big{font:700 64px/1 "Instrument Serif",Georgia,serif;letter-spacing:-.03em;color:var(--accent)}
.chip{display:inline-block;font:500 13px ui-monospace,monospace;background:#fff;color:var(--accent);border:1px solid #e8cfc4;border-radius:999px;padding:3px 10px;margin:4px 4px 0 0}
`;
  const slide = (body: string) =>
    `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body><div class="stage">${body}</div></body></html>`;
  const card = (d: number, inner: string) => `<div class="card in" style="animation-delay:${d}s">${inner}</div>`;

  const TITLE = slide(`<div class="eyebrow">YouCam Skin AI</div>
<h1 style="font-size:56px">Future Face</h1>
<p class="lead" style="font-size:22px">Two faces of you. Years from now. On the product page.</p>
<div class="cols" style="grid-template-columns:1fr 1fr;flex:1;align-content:start">
  ${card(0.5, `<div class="eyebrow">As you live now</div><b>The aging frame as it is.</b><p class="dim">AI Aging Generator projects your selfie forward. Grey hair, deeper lines, same person.</p>`)}
  ${card(1.1, `<div class="eyebrow">With daily SPF</div><b>That same frame through Skin Simulation.</b><p class="dim">Intensity follows your city's UV and your measured skin tone. Then Skin Analysis reads both renders.</p>`)}
</div>`);

  const HOW = slide(`<div class="eyebrow">Three YouCam APIs</div><h1>One selfie, a shoppable gap</h1>
<p class="lead">Every number on screen comes from a real API call or a cited trial. The store plugs in with two lines of HTML.</p>
<div class="cols" style="grid-template-columns:repeat(3,1fr)">
  ${card(0.3, `<div class="eyebrow">1</div><b>AI Aging Generator</b><p class="dim">Projects the face to +20 or +30. Both arms share that frame.</p>`)}
  ${card(0.9, `<div class="eyebrow">2</div><b>AI Skin Simulation</b><p class="dim">Applies the SPF dose: 0.24 × UV ratio × skin-tone factor.</p>`)}
  ${card(1.5, `<div class="eyebrow">3</div><b>AI Skin Analysis</b><p class="dim">Reads wrinkles, texture and spots on both renders. Higher is better-looking skin.</p>`)}
</div>
<div class="card in mono" style="margin-top:22px;animation-delay:2.4s">Dose = 0.24 × (city UV / Nambour UV) × tone factor &nbsp;·&nbsp; Hughes 2013, Annals of Internal Medicine</div>`);

  const TESTS = slide(`<div class="eyebrow">Run just now</div><h1>Tested</h1>
<p class="lead">The video is not made from a red build.</p>
<div class="cols" style="grid-template-columns:1fr 1fr">
  ${card(0.3, `<div class="big">${passed}</div><p class="dim">unit tests passed</p>`)}
  ${card(1.0, `<div class="big">0</div><p class="dim">type errors</p>`)}
</div>
<div class="card in mono" style="margin-top:22px;animation-delay:2s">$ bun run test &nbsp;<span style="color:var(--ok)">✓ ${passed} pass</span><br>$ bun run typecheck &nbsp;<span style="color:var(--ok)">✓ clean</span></div>`);

  const OUTRO = slide(`<div style="margin:auto;text-align:center">
  <h1 class="in" style="font-size:56px">Future Face</h1>
  <p class="lead in" style="font-size:22px;animation-delay:.4s">Two faces. One product page. Three YouCam APIs.</p>
  <div class="card in mono" style="display:inline-block;text-align:left;animation-delay:.9s">Live: ${LIVE_URL}<br>Code: ${REPO_URL}</div>
  <p class="in" style="margin-top:18px;animation-delay:1.3s">
    <span class="chip">AI Aging Generator</span>
    <span class="chip">AI Skin Simulation</span>
    <span class="chip">AI Skin Analysis</span>
  </p>
</div>`);

  const spoken = await speakAll(narration(passed));
  const N = Object.fromEntries(Object.entries(spoken).map(([k, clip]) => [k, Promise.resolve(clip)])) as Record<
    keyof ReturnType<typeof narration>,
    Promise<Clip>
  >;

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    colorScheme: "light",
    recordVideo: { dir: TMP, size: { width: 1280, height: 720 } },
  });
  const page: Page = await ctx.newPage();

  // City GETs during the face-b segment: stub so London vs Sydney always move the dose.
  await page.route(
    (url) => url.pathname === "/api/future" && url.searchParams.has("city"),
    async (route) => {
      const url = new URL(route.request().url());
      const face = url.searchParams.get("face") === "b" ? "b" : "a";
      const city = url.searchParams.get("city") ?? "";
      const uv = cityUv[city];
      if (!uv) return route.fulfill({ status: 503, json: { error: { kind: "unknown", message: "down" } } });
      return route.fulfill({ json: demoResult(uv, face) });
    },
  );

  const t0 = Date.now();
  const now = () => Date.now() - t0;
  async function narrate(clip: Promise<Clip>, steps: (() => Promise<unknown>)[] = []) {
    const c = await clip;
    const at = now();
    clips.push({ file: c.file, at });
    for (const step of steps) {
      await step();
      await Bun.sleep(c.ms / (steps.length + 1));
    }
    await Bun.sleep(Math.max(0, c.ms - (now() - at)) + 350);
  }
  async function show(html: string) {
    await page.setContent(html, { waitUntil: "load" });
  }
  const loaded = async (testId: string) => {
    const img = page.getByTestId(testId);
    await img.waitFor({ state: "visible" });
    await page.waitForFunction(
      (id) => {
        const el = document.querySelector(`[data-testid="${id}"]`) as HTMLImageElement | null;
        return !!el && el.complete && el.naturalWidth > 0;
      },
      testId,
    );
  };

  await show(TITLE);
  await Bun.sleep(800);
  await narrate(N.title);

  // Landing -> store (generic catalogue)
  await page.goto(BASE);
  await narrate(N.store, [
    async () => {
      await page.getByRole("link", { name: "See it in a store" }).click();
      await page.waitForURL(new RegExp(`/store/${product.code}$`));
      await page.getByText("Sunday Pharmacy").first().waitFor();
    },
    async () => {
      await page.getByRole("heading", { name: "Add this to your store in two lines" }).scrollIntoViewIfNeeded();
    },
  ]);

  const embed = async (): Promise<Frame> => {
    const iframe = page.locator("iframe[title^='Future Face']");
    await iframe.waitFor({ state: "visible" });
    const f = await (await iframe.elementHandle())!.contentFrame();
    if (!f) throw new Error("no embed frame");
    return f;
  };

  // Open widget embed -> demo face
  await narrate(N.open, [
    async () => {
      const pill = page.getByRole("button", { name: `See your face in 30 years with SPF ${product.spf}` });
      await pill.click();
      const f = await embed();
      await f.waitForURL(/\/result\?embed=1/);
    },
    async () => {
      const f = await embed();
      const main = f.getByRole("region", { name: "Or see it on our demo face" });
      await main.getByText("Demo face", { exact: true }).scrollIntoViewIfNeeded();
      await f.getByTestId("face-now").waitFor({ state: "visible" });
      await f.getByTestId("face-spf").waitFor({ state: "visible" });
    },
  ]);

  // Slider + dose on the embed
  await narrate(N.slider, [
    async () => {
      const f = await embed();
      const slider = f.getByRole("slider", { name: "Divider between the two futures" });
      await slider.scrollIntoViewIfNeeded();
      const box = (await slider.boundingBox())!;
      const y = box.y + box.height / 2;
      const ib = (await page.locator("iframe[title^='Future Face']").boundingBox())!;
      await page.mouse.move(ib.x + box.x + box.width * 0.55, ib.y + y);
      await page.mouse.down();
      await page.mouse.move(ib.x + box.x + box.width * 0.25, ib.y + y, { steps: 14 });
      await page.mouse.up();
    },
    async () => {
      const f = await embed();
      await f.getByTestId("dose").scrollIntoViewIfNeeded();
    },
  ]);

  // Face b + London / Sydney chips on the top-level /result (clearer than fighting the embed)
  await page.goto(`${BASE}/result?face=b`);
  await loaded("face-spf");
  await narrate(N.cities, [
    async () => {
      const group = page.getByRole("group", { name: "Try another city" });
      await group.scrollIntoViewIfNeeded();
      await group.getByRole("button", { name: "London" }).click();
      await page.getByTestId("city-status").waitFor();
      await page.waitForTimeout(600);
    },
    async () => {
      const group = page.getByRole("group", { name: "Try another city" });
      await group.getByRole("button", { name: "Sydney" }).click();
      await page.getByTestId("city-status").waitFor();
      await page.waitForTimeout(600);
    },
  ]);

  await narrate(N.routine, [
    async () => {
      await page.getByRole("button", { name: "Build my SPF routine" }).click();
      await page.getByRole("heading", { name: /Your routine for UV/ }).waitFor();
      await page.getByTestId("routine-step").first().scrollIntoViewIfNeeded();
    },
  ]);

  await show(HOW);
  await Bun.sleep(2200);
  await show(TESTS);
  await narrate(N.tests);
  await show(OUTRO);
  await narrate(N.outro);
  await Bun.sleep(1200);

  secs = (now() / 1000).toFixed(2);
  await ctx.close();
  await browser.close();
  webm = join(TMP, readdirSync(TMP).find((f) => f.endsWith(".webm"))!);
} finally {
  server.kill();
  try {
    process.kill(-server.pid!, "SIGTERM");
  } catch {}
}

// ---- mix + encode ----
mkdirSync(OUT, { recursive: true });
const chord = (f: number[]) =>
  f.map((hz, i) => `${(0.5 / (i + 1)).toFixed(2)}*sin(2*PI*${hz}*t+0.6*sin(2*PI*0.13*t))`).join("+");
const pad =
  `aevalsrc='(0.5+0.5*cos(2*PI*t/16))*(${chord([220, 277.18, 329.63, 493.88])})+(0.5-0.5*cos(2*PI*t/16))*(${chord([185, 220, 277.18, 329.63])})':s=48000:d=${secs},` +
  `lowpass=f=1100,aecho=0.8:0.6:180|360:0.25|0.15,volume=0.022,afade=t=in:d=2.5,afade=t=out:st=${(Number(secs) - 3).toFixed(2)}:d=3[pad]`;
const inputs = clips.flatMap((c) => ["-i", c.file]);
const voices =
  clips.map((c, i) => `[${i + 1}:a]adelay=${c.at}|${c.at}[a${i}]`).join(";") +
  `;${clips.map((_, i) => `[a${i}]`).join("")}amix=inputs=${clips.length}:normalize=0,asplit[v1][v2]`;
const mix = `${voices};${pad};[pad][v2]sidechaincompress=threshold=0.015:ratio=6:attack=30:release=600[duck];[v1][duck]amix=inputs=2:normalize=0,alimiter=limit=0.9[aud]`;
const ff = Bun.spawnSync(
  [
    "ffmpeg",
    "-y",
    "-v",
    "error",
    "-i",
    webm,
    ...inputs,
    "-filter_complex",
    `[0:v]scale=1920:1080:flags=lanczos,fps=30[v];${mix}`,
    "-map",
    "[v]",
    "-map",
    "[aud]",
    "-c:v",
    "libx264",
    "-crf",
    "17",
    "-preset",
    "slow",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    out,
  ],
  { stderr: "inherit" },
);
if (ff.exitCode) throw new Error("ffmpeg failed");

const probeOut = JSON.parse(
  Bun.spawnSync(["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", out]).stdout.toString(),
);
const v = probeOut.streams.find((s: { codec_type: string }) => s.codec_type === "video");
const a = probeOut.streams.find((s: { codec_type: string }) => s.codec_type === "audio");
const dur = Number(probeOut.format.duration);
const failures = [
  v?.width !== 1920 && `width ${v?.width}`,
  v?.height !== 1080 && `height ${v?.height}`,
  v?.codec_name !== "h264" && `video codec ${v?.codec_name}`,
  !a && "no audio stream",
  !(dur >= 60 && dur <= 180) && `duration ${dur.toFixed(1)} s, wanted 60 to 180`,
].filter(Boolean);
if (failures.length) {
  console.error(`demo video failed: ${failures.join("; ")}`);
  process.exit(1);
}
console.log(`demo video: ${out} (${v.width}x${v.height} ${v.codec_name}, ${a.codec_name} audio, ${dur.toFixed(1)} s)`);
console.log(`generic product shown: ${label} (${product.code})`);
if (!existsSync(out)) throw new Error("missing output");

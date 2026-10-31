// Records the demo faces.
//   bun run record                                 face a (fixtures/demo/): SPF arm only, reusing the recorded aging and now arm (130 units).
//   bun run record -- --face b --src <image>       face b (fixtures/demo-b/) from scratch: AI Aging, now arm, SPF arm (~150 units).
// Face b is resumable: progress goes to fixtures/demo-b/partial.json after every paid call and finished steps are skipped,
// so a failure (insufficient_units, timeout) never pays twice. `--dry-run` prints the plan only.
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { DOSE_STEPS, simSettings, TRIAL_INTENSITY } from "../lib/evidence";
import type { Horizon } from "../lib/fixtures";
import { prepareForAging, prepareForSimulation } from "../lib/image";
import { HORIZONS, withCropLadder } from "../lib/pipeline";
import type { SkinAnalysis } from "../lib/youcam";
import { ageFace, analyzeSkin, downloadFrame, hasYoucamKey, pickNearest, simulateSkin, YoucamError } from "../lib/youcam";

const args = process.argv.slice(2).filter((a) => a !== "--");
const flag = (name: string) => args[args.indexOf(name) + 1];
const FACE = args.includes("--face") ? flag("--face") : "a";
if (FACE !== "a" && FACE !== "b") throw new Error(`unknown --face ${FACE} (a or b)`);
const SRC = FACE === "a" ? "fixtures/source/face-original.jpg" : flag("--src");
const FINALIZE = args.includes("--finalize");
if (FINALIZE && FACE !== "b") throw new Error("--finalize is only for --face b");
if (FACE === "b" && !SRC && !FINALIZE) throw new Error("--face b needs --src <image>");
const DEMO = FACE === "a" ? "fixtures/demo" : "fixtures/demo-b";
const SOURCE_MD = FACE === "a" ? "fixtures/source/source.md" : "fixtures/source/source-b.md";
const ACTIONS = ["wrinkle", "age_spot", "texture"];
const AGING_UNITS = 2;
const SIM_UNITS = 4;
const ANALYSIS_UNITS = 9;
const opts = { timeoutMs: 300_000, intervalMs: 3000 };

const spfUnits = HORIZONS.length * DOSE_STEPS.length * (SIM_UNITS + ANALYSIS_UNITS);
const nowUnits = HORIZONS.length * ANALYSIS_UNITS;
const total = FACE === "a" ? spfUnits : AGING_UNITS + nowUnits + spfUnits;
const stepName = (years: number, intensity: number) => `spf-${years}-${String(Math.round(intensity * 100)).padStart(3, "0")}.jpg`;
const rawName = (years: number) => `aged-${years}-now-raw.jpg`;

console.log(`plan (face ${FACE}, ${DEMO}): ${HORIZONS.length} horizons x ${DOSE_STEPS.length} steps (${DOSE_STEPS.join(", ")}) x (Skin Simulation ${SIM_UNITS} + Skin Analysis ${ANALYSIS_UNITS}) = ${spfUnits} units`);
if (FACE === "a") console.log("reused at 0 units: aging.json, aged-<years>-now-raw.jpg, now-<years>.jpg and their analysis in result.json");
else console.log(`plus AI Aging ${AGING_UNITS} + now-arm Skin Analysis ${HORIZONS.length} x ${ANALYSIS_UNITS} = ${AGING_UNITS + nowUnits} units; total ${total} units, resumable via ${DEMO}/partial.json`);
for (const years of HORIZONS) console.log(`  +${years}: ${DOSE_STEPS.map((i) => stepName(years, i)).join(", ")}`);
if (args.includes("--dry-run")) {
  console.log("dry run: nothing spent, nothing written");
  process.exit(0);
}

if (!FINALIZE && !hasYoucamKey()) {
  console.error("YOUCAM_SECRET_KEY is not set (add it to .env). Nothing was recorded.");
  process.exit(1);
}

const save = async (name: string, bytes: Uint8Array) => {
  writeFileSync(`${DEMO}/${name}`, bytes);
  const m = await sharp(bytes).metadata();
  console.log(`  saved ${DEMO}/${name} (${m.width}x${m.height}, ${bytes.length} bytes)`);
};

// Shared by both faces: Skin Simulation of a raw aging frame at one intensity, and Skin Analysis of a rendered image.
// No crop first: the raw frame already holds the whole head. Crop in (CROP_LADDER) only if the face is too small.
async function simulate(raw: Uint8Array, intensity: number): Promise<Buffer> {
  const { sim } = await withCropLadder(raw, prepareForSimulation, async (base) => ({ sim: await simulateSkin(base, simSettings(intensity), opts) }));
  return sharp(sim).jpeg({ quality: 92 }).toBuffer(); // the API returns png
}
const analyze = (img: Uint8Array) => analyzeSkin(img, { ...opts, actions: ACTIONS });

const writeResult = (r: { inputAge: number; frames: number[]; horizons: Horizon[] }) =>
  writeFileSync(
    `${DEMO}/result.json`,
    JSON.stringify({ recordedAt: new Date().toISOString(), source: SOURCE_MD, ...r, settings: { trialIntensity: TRIAL_INTENSITY } }, null, 2) + "\n",
  );

async function recordFaceA() {
  const input = await prepareForAging(readFileSync(SRC));
  const aging = JSON.parse(readFileSync(`${DEMO}/aging.json`, "utf8"));
  if (aging.inputHash !== createHash("sha1").update(input).digest("hex")) throw new Error("aging.json is for a different source image; refusing to re-age");
  const old = JSON.parse(readFileSync(`${DEMO}/result.json`, "utf8")) as { horizons: { years: number; now: Horizon["now"] }[] };

  const horizons: Horizon[] = [];
  for (const years of HORIZONS) {
    const p = aging.picked.find((x: { years: number }) => x.years === years);
    const now = old.horizons.find((h) => h.years === years)?.now;
    if (!p || !now || !existsSync(`${DEMO}/${rawName(years)}`) || !existsSync(`${DEMO}/${now.image}`)) throw new Error(`missing recorded now arm for +${years}`);
    const raw = readFileSync(`${DEMO}/${rawName(years)}`);
    const spf: Horizon["spf"] = [];
    for (const intensity of DOSE_STEPS) {
      console.log(`+${years} @ ${intensity}: Skin Simulation (${SIM_UNITS} units), then Skin Analysis (${ANALYSIS_UNITS} units)`);
      const img = await simulate(raw, intensity);
      const image = stepName(years, intensity);
      await save(image, img);
      spf.push({ intensity, image, analysis: await analyze(img) });
    }
    horizons.push({ years: years as 20 | 30, targetAge: aging.inputAge + years, resAge: p.nowResAge ?? p.resAge, now, spf });
  }

  writeResult({ inputAge: aging.inputAge, frames: aging.frames, horizons });
  writeFileSync(
    `${DEMO}/aging.json`,
    JSON.stringify({ inputHash: aging.inputHash, inputAge: aging.inputAge, frames: aging.frames, picked: horizons.map((h) => ({ years: h.years, resAge: h.resAge })) }, null, 2) + "\n",
  );
  console.log(`wrote ${DEMO}/result.json (${total} units used)`);
}

type Progress = {
  inputHash: string;
  inputAge?: number;
  frames?: number[];
  picked?: { years: number; resAge: number }[];
  now: Record<string, SkinAnalysis>; // by years
  spf: Record<string, SkinAnalysis>; // by `${years}-${intensity}`
};

async function recordFaceB() {
  if (!existsSync(SRC)) throw new Error(`--src ${SRC} not found`);
  mkdirSync(DEMO, { recursive: true });
  const partialPath = `${DEMO}/partial.json`;
  const input = await prepareForAging(readFileSync(SRC));
  const inputHash = createHash("sha1").update(input).digest("hex");

  let partial: Progress = { inputHash, now: {}, spf: {} };
  if (existsSync(partialPath)) {
    partial = JSON.parse(readFileSync(partialPath, "utf8"));
    if (partial.inputHash !== inputHash) throw new Error(`${partialPath} is for a different source image; delete it to start over`);
    console.log(`resuming from ${partialPath}`);
  } else if (existsSync(`${DEMO}/result.json`)) {
    throw new Error(`${DEMO}/result.json already exists; delete the folder contents to re-record from scratch`);
  }
  const checkpoint = () => writeFileSync(partialPath, JSON.stringify(partial, null, 2) + "\n");
  const have = (name: string) => existsSync(`${DEMO}/${name}`);

  writeFileSync(`${DEMO}/input.jpg`, input);

  // 1. AI Aging; the frame urls expire, so both picked frames are downloaded (free) before anything else is spent.
  if (!partial.picked || !partial.frames || partial.inputAge === undefined || !HORIZONS.every((y) => have(rawName(y)))) {
    console.log(`AI Aging Generator (${AGING_UNITS} units)`);
    const aged = await ageFace(input, opts);
    if (aged.inputAge === undefined) throw new Error("aging returned no input age");
    partial.inputAge = aged.inputAge;
    partial.frames = aged.frames.map((f) => f.resAge);
    partial.picked = [];
    for (const years of HORIZONS) {
      const frame = pickNearest(aged.frames, aged.inputAge, years);
      if (!frame) throw new Error(`no aging frame for +${years}`);
      partial.picked.push({ years, resAge: frame.resAge });
      await save(rawName(years), await downloadFrame(frame.url, opts));
    }
    checkpoint();
  }
  const { inputAge, frames, picked } = partial as Required<Pick<Progress, "inputAge" | "frames" | "picked">>;

  const horizons: Horizon[] = [];
  for (const { years, resAge } of picked) {
    const raw = readFileSync(`${DEMO}/${rawName(years)}`);

    // 2. now arm: the raw frame, prepared, plus its analysis.
    const nowImage = `now-${years}.jpg`;
    if (!have(nowImage) || !partial.now[years]) {
      console.log(`+${years} now: Skin Analysis (${ANALYSIS_UNITS} units)`);
      const { img, a } = await withCropLadder(raw, prepareForSimulation, async (img) => ({ img, a: await analyze(img) }));
      await save(nowImage, img);
      partial.now[years] = a;
      checkpoint();
    }

    // 3. spf arm: a paid simulation is saved before its analysis, so a failed analysis never repays the simulation.
    const spf: Horizon["spf"] = [];
    for (const intensity of DOSE_STEPS) {
      const image = stepName(years, intensity);
      const key = `${years}-${intensity}`;
      if (!have(image) || !partial.spf[key]) {
        let img: Uint8Array;
        if (have(image)) img = readFileSync(`${DEMO}/${image}`);
        else {
          console.log(`+${years} @ ${intensity}: Skin Simulation (${SIM_UNITS} units)`);
          await save(image, (img = await simulate(raw, intensity)));
        }
        console.log(`+${years} @ ${intensity}: Skin Analysis (${ANALYSIS_UNITS} units)`);
        partial.spf[key] = await analyze(img);
        checkpoint();
      }
      spf.push({ intensity, image, analysis: partial.spf[key] });
    }
    horizons.push({ years: years as 20 | 30, targetAge: inputAge + years, resAge, now: { image: nowImage, analysis: partial.now[years] }, spf });
  }

  writeResult({ inputAge, frames, horizons });
  writeFileSync(`${DEMO}/aging.json`, JSON.stringify({ inputHash, inputAge, frames, picked }, null, 2) + "\n");
  unlinkSync(partialPath);
  console.log(`wrote ${DEMO}/result.json`);
}

// No network, no key: writes result.json from partial.json with only the horizons whose now arm and every SPF step are
// recorded. partial.json stays, so rerunning the record command later tops up the missing horizon and rewrites result.json.
function finalizeFaceB() {
  const partial = JSON.parse(readFileSync(`${DEMO}/partial.json`, "utf8")) as Progress;
  const { inputAge, frames, picked } = partial;
  if (inputAge === undefined || !frames || !picked) throw new Error(`${DEMO}/partial.json has no aging yet; nothing to finalize`);
  const horizons: Horizon[] = [];
  for (const { years, resAge } of picked) {
    const nowImage = `now-${years}.jpg`;
    const steps = DOSE_STEPS.map((intensity) => ({ intensity, image: stepName(years, intensity), analysis: partial.spf[`${years}-${intensity}`] }));
    const done = partial.now[years] && existsSync(`${DEMO}/${nowImage}`) && steps.every((s) => s.analysis && existsSync(`${DEMO}/${s.image}`));
    if (!done) {
      console.log(`+${years} is not fully recorded, left out`);
      continue;
    }
    horizons.push({ years: years as 20 | 30, targetAge: inputAge + years, resAge, now: { image: nowImage, analysis: partial.now[years] }, spf: steps });
  }
  if (!horizons.length) throw new Error("no fully recorded horizon; nothing to finalize");
  writeResult({ inputAge, frames, horizons });
  console.log(`wrote ${DEMO}/result.json with horizons +${horizons.map((h) => h.years).join(", +")} (no API call made)`);
}

if (FINALIZE) {
  try {
    finalizeFaceB();
  } catch (e) {
    console.error(`FAILED: ${e instanceof Error ? e.message : "unknown error"}`);
    process.exit(1);
  }
} else
(FACE === "a" ? recordFaceA() : recordFaceB()).catch((e) => {
  if (e instanceof YoucamError) console.error(`FAILED: YoucamError code=${e.code} kind=${e.kind} (http status is in the code when it starts with http_)`);
  else console.error(`FAILED: ${e instanceof Error ? e.message : "unknown error"}`);
  if (FACE === "b") console.error(`progress is kept in ${DEMO}/partial.json; rerun the same command to resume`);
  process.exit(1);
});

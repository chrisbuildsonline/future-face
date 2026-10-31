// Records the SPF arm of fixtures/demo/: one Skin Simulation + one Skin Analysis per horizon per DOSE_STEPS value.
// Reuses the recorded aging (aging.json, aged-<years>-now-raw.jpg) and the now-arm images and analyses already in
// result.json, so only the SPF renders cost units (130). Run once; `bun run record -- --dry-run` prints the plan only.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { DOSE_STEPS, simSettings, TRIAL_INTENSITY } from "../lib/evidence";
import type { Horizon } from "../lib/fixtures";
import { prepareForAging, prepareForSimulation } from "../lib/image";
import { HORIZONS, withCropLadder } from "../lib/pipeline";
import { analyzeSkin, hasYoucamKey, simulateSkin, YoucamError } from "../lib/youcam";

const SRC = "fixtures/source/face-original.jpg";
const DEMO = "fixtures/demo";
const ACTIONS = ["wrinkle", "age_spot", "texture"];
const SIM_UNITS = 4;
const ANALYSIS_UNITS = 9;
const opts = { timeoutMs: 300_000, intervalMs: 3000 };

const total = HORIZONS.length * DOSE_STEPS.length * (SIM_UNITS + ANALYSIS_UNITS);
const stepName = (years: number, intensity: number) => `spf-${years}-${String(Math.round(intensity * 100)).padStart(3, "0")}.jpg`;

console.log(`plan: ${HORIZONS.length} horizons x ${DOSE_STEPS.length} steps (${DOSE_STEPS.join(", ")}) x (Skin Simulation ${SIM_UNITS} + Skin Analysis ${ANALYSIS_UNITS}) = ${total} units`);
console.log("reused at 0 units: aging.json, aged-<years>-now-raw.jpg, now-<years>.jpg and their analysis in result.json");
for (const years of HORIZONS) console.log(`  +${years}: ${DOSE_STEPS.map((i) => stepName(years, i)).join(", ")}`);
if (process.argv.includes("--dry-run")) {
  console.log("dry run: nothing spent, nothing written");
  process.exit(0);
}

if (!hasYoucamKey()) {
  console.error("YOUCAM_SECRET_KEY is not set (add it to .env). Nothing was recorded.");
  process.exit(1);
}

const save = async (name: string, bytes: Uint8Array) => {
  writeFileSync(`${DEMO}/${name}`, bytes);
  const m = await sharp(bytes).metadata();
  console.log(`  saved ${DEMO}/${name} (${m.width}x${m.height}, ${bytes.length} bytes)`);
};

async function main() {
  const input = await prepareForAging(readFileSync(SRC));
  const aging = JSON.parse(readFileSync(`${DEMO}/aging.json`, "utf8"));
  if (aging.inputHash !== createHash("sha1").update(input).digest("hex")) throw new Error("aging.json is for a different source image; refusing to re-age");
  const old = JSON.parse(readFileSync(`${DEMO}/result.json`, "utf8")) as { horizons: { years: number; now: Horizon["now"] }[] };
  const rawPath = (years: number) => `${DEMO}/aged-${years}-now-raw.jpg`;

  const horizons: Horizon[] = [];
  for (const years of HORIZONS) {
    const p = aging.picked.find((x: { years: number }) => x.years === years);
    const now = old.horizons.find((h) => h.years === years)?.now;
    if (!p || !now || !existsSync(rawPath(years)) || !existsSync(`${DEMO}/${now.image}`)) throw new Error(`missing recorded now arm for +${years}`);
    const raw = readFileSync(rawPath(years));
    const spf: Horizon["spf"] = [];
    for (const intensity of DOSE_STEPS) {
      console.log(`+${years} @ ${intensity}: Skin Simulation (${SIM_UNITS} units), then Skin Analysis (${ANALYSIS_UNITS} units)`);
      // No crop first: the raw frame already holds the whole head. Crop in (CROP_LADDER) only if the face is too small.
      const { sim } = await withCropLadder(raw, prepareForSimulation, async (base) => ({
        sim: await simulateSkin(base, simSettings(intensity), opts),
      }));
      const img = await sharp(sim).jpeg({ quality: 92 }).toBuffer(); // the API returns png
      const image = stepName(years, intensity);
      await save(image, img);
      spf.push({ intensity, image, analysis: await analyzeSkin(img, { ...opts, actions: ACTIONS }) });
    }
    horizons.push({ years: years as 20 | 30, targetAge: aging.inputAge + years, resAge: p.nowResAge ?? p.resAge, now, spf });
  }

  const result = {
    recordedAt: new Date().toISOString(),
    source: "fixtures/source/source.md",
    inputAge: aging.inputAge,
    frames: aging.frames,
    horizons,
    settings: { trialIntensity: TRIAL_INTENSITY },
  };
  writeFileSync(`${DEMO}/result.json`, JSON.stringify(result, null, 2) + "\n");
  writeFileSync(
    `${DEMO}/aging.json`,
    JSON.stringify({ inputHash: aging.inputHash, inputAge: aging.inputAge, frames: aging.frames, picked: horizons.map((h) => ({ years: h.years, resAge: h.resAge })) }, null, 2) + "\n",
  );
  console.log(`wrote ${DEMO}/result.json (${total} units used)`);
}

main().catch((e) => {
  if (e instanceof YoucamError) console.error(`FAILED: YoucamError code=${e.code} kind=${e.kind} (http status is in the code when it starts with http_)`);
  else console.error(`FAILED: ${e instanceof Error ? e.message : "unknown error"}`);
  process.exit(1);
});

// One live run against YouCam that records fixtures/demo/. Costs about 50 units: run it once.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { SPF_AGING_REDUCTION, SPF_SETTINGS } from "../lib/evidence";
import { prepareForAging, prepareForSimulation } from "../lib/image";
import { HORIZONS, pickArmFrames, withCropLadder } from "../lib/pipeline";
import { ageFace, analyzeSkin, downloadFrame, hasYoucamKey, simulateSkin, YoucamError } from "../lib/youcam";

if (!hasYoucamKey()) {
  console.error("YOUCAM_SECRET_KEY is not set (add it to .env). Nothing was recorded.");
  process.exit(1);
}

const SRC = "fixtures/source/face-original.jpg";
const DEMO = "fixtures/demo";
const ACTIONS = ["wrinkle", "age_spot", "texture"];
const opts = { timeoutMs: 300_000, intervalMs: 3000 };

const save = async (name: string, bytes: Uint8Array) => {
  writeFileSync(`${DEMO}/${name}`, bytes);
  const m = await sharp(bytes).metadata();
  console.log(`  saved ${DEMO}/${name} (${m.width}x${m.height}, ${bytes.length} bytes)`);
};

type Picked = { years: number; nowResAge: number; spfResAge: number };

async function main() {
  mkdirSync(DEMO, { recursive: true });

  console.log("step 1: prepare input and save (0 units)");
  const input = await prepareForAging(readFileSync(SRC));
  await save("input.jpg", input);
  const inputHash = createHash("sha1").update(input).digest("hex");

  // Reuse a recorded aging step only if it came from this exact source (saves 2 units and keeps the same frames).
  const agingPath = `${DEMO}/aging.json`;
  const rawPath = (years: number, arm: "now" | "spf") => `${DEMO}/aged-${years}-${arm}-raw.jpg`;
  let inputAge: number;
  let frames: number[];
  let picked: Picked[];
  const recorded = existsSync(agingPath) ? JSON.parse(readFileSync(agingPath, "utf8")) : null;
  if (
    recorded?.inputHash === inputHash &&
    recorded.spfAgingReduction === SPF_AGING_REDUCTION &&
    HORIZONS.every((y) => existsSync(rawPath(y, "now")) && existsSync(rawPath(y, "spf")))
  ) {
    console.log("step 2: reusing recorded aging (0 units)");
    ({ inputAge, frames, picked } = recorded);
  } else {
    console.log("step 2: AI Aging Generator (~2 units)");
    const aged = await ageFace(input, opts);
    if (aged.inputAge === undefined) throw new Error("aging returned no input age");
    inputAge = aged.inputAge;
    frames = aged.frames.map((f) => f.resAge);
    picked = [];
    for (const years of HORIZONS) {
      const { now, spf } = pickArmFrames(aged.frames, inputAge, years);
      if (!now || !spf) throw new Error(`no frame for +${years}`);
      await save(`aged-${years}-now-raw.jpg`, await downloadFrame(now.url, opts));
      await save(`aged-${years}-spf-raw.jpg`, now.url === spf.url ? readFileSync(rawPath(years, "now")) : await downloadFrame(spf.url, opts));
      picked.push({ years, nowResAge: now.resAge, spfResAge: spf.resAge });
    }
    writeFileSync(agingPath, JSON.stringify({ inputHash, spfAgingReduction: SPF_AGING_REDUCTION, inputAge, frames, picked }, null, 2) + "\n");
  }
  console.log(`  inputAge=${inputAge}, frames res_age=[${frames.join(", ")}]`);
  for (const p of picked) console.log(`  +${p.years}: now res_age=${p.nowResAge}, spf res_age=${p.spfResAge}`);

  const horizons: any[] = [];
  for (const { years, nowResAge, spfResAge } of picked) {
    const sameFrame = nowResAge === spfResAge;
    console.log(`step 3 (+${years}): simulate SPF arm on its own frame (~4 units)`);
    // No crop first: the raw frame already holds the whole head. Crop in (CROP_LADDER) only if the face is too small.
    const spfArm = await withCropLadder(readFileSync(rawPath(years, "spf")), prepareForSimulation, async (base) => ({
      sim: await simulateSkin(base, SPF_SETTINGS, opts),
    }));
    const spf = await sharp(spfArm.sim).jpeg({ quality: 92 }).toBuffer(); // the API returns png
    const now = await prepareForSimulation(readFileSync(rawPath(years, "now")));
    await save(`now-${years}.jpg`, now);
    await save(`spf-${years}.jpg`, spf);

    console.log(`step 4 (+${years}): skin analysis, both arms (2 x ~9 units)`);
    const nowAnalysis = await analyzeSkin(now, { ...opts, actions: ACTIONS });
    const spfAnalysis = await analyzeSkin(spf, { ...opts, actions: ACTIONS });
    horizons.push({
      years,
      targetAge: inputAge + years,
      resAge: nowResAge,
      spfResAge,
      ...(sameFrame ? { sameFrame: true } : {}),
      now: { image: `now-${years}.jpg`, analysis: nowAnalysis },
      spf: { image: `spf-${years}.jpg`, analysis: spfAnalysis },
    });
  }

  const result = {
    recordedAt: new Date().toISOString(),
    source: "fixtures/source/source.md",
    inputAge,
    frames,
    horizons,
    settings: SPF_SETTINGS,
  };
  writeFileSync(`${DEMO}/result.json`, JSON.stringify(result, null, 2) + "\n");
  console.log(`wrote ${DEMO}/result.json (about 50 units used)`);
}

main().catch((e) => {
  if (e instanceof YoucamError) console.error(`FAILED: YoucamError code=${e.code} kind=${e.kind} (http status is in the code when it starts with http_)`);
  else console.error(`FAILED: ${e instanceof Error ? e.message : "unknown error"}`);
  process.exit(1);
});

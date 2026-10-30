// One live run against YouCam that records fixtures/demo/. Costs about 46 units: run it once.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { SPF_SETTINGS } from "../lib/evidence";
import { cropToCenter, prepareForAging, prepareForSimulation } from "../lib/image";
import { ageFace, analyzeSkin, downloadFrame, hasYoucamKey, pickNearest, simulateSkin, YoucamError } from "../lib/youcam";

if (!hasYoucamKey()) {
  console.error("YOUCAM_SECRET_KEY is not set (add it to .env). Nothing was recorded.");
  process.exit(1);
}

const SRC = "fixtures/source/face-original.jpg";
const DEMO = "fixtures/demo";
const HORIZONS = [10, 20];
const ACTIONS = ["wrinkle", "age_spot", "texture"];
const opts = { timeoutMs: 300_000, intervalMs: 3000 };

const save = async (name: string, bytes: Uint8Array) => {
  writeFileSync(`${DEMO}/${name}`, bytes);
  const m = await sharp(bytes).metadata();
  console.log(`  saved ${DEMO}/${name} (${m.width}x${m.height}, ${bytes.length} bytes)`);
};

async function main() {
  mkdirSync(DEMO, { recursive: true });

  console.log("step 1: prepare input and save (0 units)");
  const input = await prepareForAging(readFileSync(SRC));
  await save("input.jpg", input);

  // Reuse a recorded aging step (saves 2 units and keeps the same frames).
  const agingPath = `${DEMO}/aging.json`;
  const rawPath = (y: number) => `${DEMO}/aged-${y}-raw.jpg`;
  let inputAge: number;
  let frames: number[];
  const picked: { years: number; resAge: number; raw: Buffer }[] = [];
  if (existsSync(agingPath) && HORIZONS.every((y) => existsSync(rawPath(y)))) {
    console.log("step 2: reusing recorded aging (0 units)");
    const a = JSON.parse(readFileSync(agingPath, "utf8"));
    inputAge = a.inputAge;
    frames = a.frames;
    for (const years of HORIZONS) picked.push({ years, resAge: a.picked[years], raw: readFileSync(rawPath(years)) });
  } else {
    console.log("step 2: AI Aging Generator (~2 units)");
    const aged = await ageFace(input, opts);
    if (aged.inputAge === undefined) throw new Error("aging returned no input age");
    inputAge = aged.inputAge;
    frames = aged.frames.map((f) => f.resAge);
    const pickedAges: Record<number, number> = {};
    for (const years of HORIZONS) {
      const frame = pickNearest(aged.frames, inputAge, years);
      if (!frame) throw new Error(`no frame for +${years}`);
      const raw = await downloadFrame(frame.url, opts);
      await save(`aged-${years}-raw.jpg`, raw);
      picked.push({ years, resAge: frame.resAge, raw });
      pickedAges[years] = frame.resAge;
    }
    writeFileSync(agingPath, JSON.stringify({ inputAge, frames, picked: pickedAges }, null, 2) + "\n");
  }
  console.log(`  inputAge=${inputAge}, frames res_age=[${frames.join(", ")}]`);
  for (const p of picked) console.log(`  +${p.years}: target ${inputAge + p.years}, picked res_age=${p.resAge}`);

  const horizons: any[] = [];
  for (const { years, resAge, raw } of picked) {
    console.log(`step 3 (+${years}): simulate SPF arm (~4 units)`);
    // No crop: the raw frame already holds the whole head. One gentler crop only if the face is too small.
    let now = await prepareForSimulation(raw);
    let spf: Buffer;
    try {
      spf = await simulateSkin(now, SPF_SETTINGS, opts);
    } catch (e) {
      if (!(e instanceof YoucamError) || e.kind !== "face_too_small") throw e;
      console.log("  face_too_small: retrying once with cropToCenter(raw, 0.92)");
      now = await prepareForSimulation(await cropToCenter(raw, 0.92));
      spf = await simulateSkin(now, SPF_SETTINGS, opts);
    }
    spf = await sharp(spf).jpeg({ quality: 92 }).toBuffer(); // the API returns png
    await save(`now-${years}.jpg`, now);
    await save(`spf-${years}.jpg`, spf);

    console.log(`step 4 (+${years}): skin analysis, both arms (2 x ~9 units)`);
    const nowAnalysis = await analyzeSkin(now, { ...opts, actions: ACTIONS });
    const spfAnalysis = await analyzeSkin(spf, { ...opts, actions: ACTIONS });
    horizons.push({
      years,
      targetAge: inputAge + years,
      resAge,
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
  console.log(`wrote ${DEMO}/result.json (about 46 units used)`);
}

main().catch((e) => {
  if (e instanceof YoucamError) console.error(`FAILED: YoucamError code=${e.code} kind=${e.kind} (http status is in the code when it starts with http_)`);
  else console.error(`FAILED: ${e instanceof Error ? e.message : "unknown error"}`);
  process.exit(1);
});

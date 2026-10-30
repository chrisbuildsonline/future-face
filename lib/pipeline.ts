import sharp from "sharp";
import { CITATION, INTENSITIES, SPF_AGING_REDUCTION, SPF_SETTINGS } from "./evidence";
import { loadDemo } from "./fixtures";
import { cropToCenter, prepareForAging, prepareForSimulation } from "./image";
import { recordedUv, type Uv } from "./uv";
import { ageFace, analyzeSkin, downloadFrame, pickNearest, simulateSkin, YoucamError } from "./youcam";
import type { AgingFrame, Opts, SkinAnalysis } from "./youcam";

export const HORIZONS = [20, 30];
const ACTIONS = ["wrinkle", "age_spot", "texture"];

/** The two arms' frames: now = nearest inputAge + years; spf = nearest inputAge + years * (1 - SPF_AGING_REDUCTION). */
export function pickArmFrames(frames: AgingFrame[], inputAge: number, years: number) {
  return {
    now: pickNearest(frames, inputAge, years),
    spf: pickNearest(frames, inputAge, years * (1 - SPF_AGING_REDUCTION)),
  };
}

/** Centre-crop fractions tried, in order, after YouCam says face_too_small. At most one retry per entry. */
export const CROP_LADDER = [0.75, 0.55];

/** Run attempt on prepare(raw); on face_too_small retry on each CROP_LADDER crop. Other errors, or the last face_too_small, are thrown. */
export async function withCropLadder<T>(
  raw: Uint8Array,
  prepare: (bytes: Uint8Array) => Promise<Buffer>,
  attempt: (prepared: Buffer) => Promise<T>,
): Promise<T> {
  let err: unknown;
  for (const fraction of [1, ...CROP_LADDER]) {
    try {
      return await attempt(await prepare(fraction === 1 ? raw : await cropToCenter(raw, fraction)));
    } catch (e) {
      if (!(e instanceof YoucamError) || e.kind !== "face_too_small") throw e;
      err = e;
    }
  }
  throw err;
}

export type Measured = { key: string; analysisKey: string; now: number; spf: number; delta: number };
export type FutureResult = {
  source: "live" | "demo";
  notice?: string;
  input?: string;
  inputAge: number;
  frames: number[];
  uv: Uv | null;
  horizons: {
    years: number;
    targetAge: number;
    resAge: number;
    spfResAge: number;
    sameFrame?: true;
    now: { image: string; skinAge?: number };
    spf: { image: string; skinAge?: number };
    measured: Measured[];
  }[];
  settings: typeof SPF_SETTINGS;
  citation: typeof CITATION;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export function measuredLine(now: SkinAnalysis, spf: SkinAnalysis): Measured[] {
  const out: Measured[] = [];
  for (const { key, analysisKey } of INTENSITIES) {
    const a = now.concerns[analysisKey];
    const b = spf.concerns[analysisKey];
    if (!a || !b) continue;
    out.push({ key, analysisKey, now: round1(a.raw_score), spf: round1(b.raw_score), delta: round1(b.raw_score - a.raw_score) });
  }
  return out;
}

const imageUrl = (name: string) => `/api/demo-image/${name}`;

export function demoResult(uv: Uv | null = recordedUv()): FutureResult {
  const d = loadDemo();
  return {
    source: "demo",
    input: imageUrl("input.jpg"),
    inputAge: d.inputAge,
    frames: d.frames,
    uv,
    horizons: d.horizons.map((h) => ({
      years: h.years,
      targetAge: h.targetAge,
      resAge: h.resAge,
      spfResAge: h.spfResAge,
      ...(h.sameFrame ? { sameFrame: true as const } : {}),
      now: { image: imageUrl(h.now.image), ...(h.now.analysis.skinAge ? { skinAge: h.now.analysis.skinAge } : {}) },
      spf: { image: imageUrl(h.spf.image), ...(h.spf.analysis.skinAge ? { skinAge: h.spf.analysis.skinAge } : {}) },
      measured: h.sameFrame ? [] : measuredLine(h.now.analysis, h.spf.analysis),
    })),
    settings: SPF_SETTINGS,
    citation: CITATION,
  };
}

const dataUrl = (jpeg: Uint8Array) => `data:image/jpeg;base64,${Buffer.from(jpeg).toString("base64")}`;

type Deps = { ageFace: typeof ageFace; downloadFrame: typeof downloadFrame; simulateSkin: typeof simulateSkin; analyzeSkin: typeof analyzeSkin };

/** Same chain as scripts/record.ts, with no uv: the route adds it. */
export async function runLive(
  selfie: Uint8Array,
  deps: Deps = { ageFace, downloadFrame, simulateSkin, analyzeSkin },
  opts: Opts = {},
): Promise<FutureResult> {
  const input = await prepareForAging(selfie).catch(() => {
    throw new YoucamError("decode_failed", "bad_format"); // sharp can't open it (garbage, HEIC)
  });
  const aged = await withCropLadder(input, prepareForAging, (b) => deps.ageFace(b, opts));
  if (aged.inputAge === undefined) throw new YoucamError("no_input_age", "no_face");
  const inputAge = aged.inputAge;

  const horizons = await Promise.all(
    HORIZONS.map(async (years) => {
      const { now: nowFrame, spf: spfFrame } = pickArmFrames(aged.frames, inputAge, years);
      if (!nowFrame || !spfFrame) throw new YoucamError("no_frame", "unknown");
      const sameFrame = nowFrame.resAge === spfFrame.resAge;
      const [nowRaw, spfRaw] = await Promise.all([
        deps.downloadFrame(nowFrame.url, opts),
        deps.downloadFrame(spfFrame.url, opts),
      ]);
      // No crop first: the raw frame already holds the whole head. Crop in only if the face is too small.
      const nowArm = await withCropLadder(nowRaw, prepareForSimulation, async (img) => ({
        img,
        a: await deps.analyzeSkin(img, { ...opts, actions: ACTIONS }),
      }));
      const spfArm = await withCropLadder(spfRaw, prepareForSimulation, async (base) => {
        const sim = await deps.simulateSkin(base, SPF_SETTINGS, opts);
        const img = await sharp(sim).jpeg({ quality: 92 }).toBuffer(); // the API returns png
        return { img, a: await deps.analyzeSkin(img, { ...opts, actions: ACTIONS }) };
      });
      return {
        years,
        targetAge: inputAge + years,
        resAge: nowFrame.resAge,
        spfResAge: spfFrame.resAge,
        ...(sameFrame ? { sameFrame: true as const } : {}),
        now: { image: dataUrl(nowArm.img), ...(nowArm.a.skinAge ? { skinAge: nowArm.a.skinAge } : {}) },
        spf: { image: dataUrl(spfArm.img), ...(spfArm.a.skinAge ? { skinAge: spfArm.a.skinAge } : {}) },
        measured: sameFrame ? [] : measuredLine(nowArm.a, spfArm.a),
      };
    }),
  );

  return {
    source: "live",
    input: dataUrl(input),
    inputAge,
    frames: aged.frames.map((f) => f.resAge),
    uv: null,
    horizons,
    settings: SPF_SETTINGS,
    citation: CITATION,
  };
}

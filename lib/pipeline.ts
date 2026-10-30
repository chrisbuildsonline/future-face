import sharp from "sharp";
import { CITATION, INTENSITIES, SPF_SETTINGS } from "./evidence";
import { loadDemo } from "./fixtures";
import { cropToCenter, prepareForAging, prepareForSimulation } from "./image";
import { recordedUv, type Uv } from "./uv";
import { ageFace, analyzeSkin, downloadFrame, pickNearest, simulateSkin, YoucamError } from "./youcam";
import type { Opts, SkinAnalysis } from "./youcam";

const HORIZONS = [10, 20];
const ACTIONS = ["wrinkle", "age_spot", "texture"];

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
      now: { image: imageUrl(h.now.image), ...(h.now.analysis.skinAge ? { skinAge: h.now.analysis.skinAge } : {}) },
      spf: { image: imageUrl(h.spf.image), ...(h.spf.analysis.skinAge ? { skinAge: h.spf.analysis.skinAge } : {}) },
      measured: measuredLine(h.now.analysis, h.spf.analysis),
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
      const frame = pickNearest(aged.frames, inputAge, years);
      if (!frame) throw new YoucamError("no_frame", "unknown");
      const raw = await deps.downloadFrame(frame.url, opts);
      // No crop first: the raw frame already holds the whole head. Crop in only if the face is too small.
      const { now, sim } = await withCropLadder(raw, prepareForSimulation, async (now) => ({
        now,
        sim: await deps.simulateSkin(now, SPF_SETTINGS, opts),
      }));
      const spf = await sharp(sim).jpeg({ quality: 92 }).toBuffer(); // the API returns png
      const [nowA, spfA] = await Promise.all([
        deps.analyzeSkin(now, { ...opts, actions: ACTIONS }),
        deps.analyzeSkin(spf, { ...opts, actions: ACTIONS }),
      ]);
      return {
        years,
        targetAge: inputAge + years,
        resAge: frame.resAge,
        now: { image: dataUrl(now), ...(nowA.skinAge ? { skinAge: nowA.skinAge } : {}) },
        spf: { image: dataUrl(spf), ...(spfA.skinAge ? { skinAge: spfA.skinAge } : {}) },
        measured: measuredLine(nowA, spfA),
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

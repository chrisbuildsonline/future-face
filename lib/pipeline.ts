import sharp from "sharp";
import { CITATION, INTENSITIES, SPF_SETTINGS } from "./evidence";
import { loadDemo } from "./fixtures";
import { cropToCenter, prepareForAging, prepareForSimulation } from "./image";
import { recordedUv, type Uv } from "./uv";
import { ageFace, analyzeSkin, downloadFrame, pickNearest, simulateSkin, YoucamError } from "./youcam";
import type { Opts, SkinAnalysis } from "./youcam";

const HORIZONS = [10, 20];
const ACTIONS = ["wrinkle", "age_spot", "texture"];

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
  const aged = await deps.ageFace(input, opts);
  if (aged.inputAge === undefined) throw new YoucamError("no_input_age", "no_face");
  const inputAge = aged.inputAge;

  const horizons = await Promise.all(
    HORIZONS.map(async (years) => {
      const frame = pickNearest(aged.frames, inputAge, years);
      if (!frame) throw new YoucamError("no_frame", "unknown");
      const raw = await deps.downloadFrame(frame.url, opts);
      // No crop: the raw frame already holds the whole head. One gentler crop only if the face is too small.
      let now = await prepareForSimulation(raw);
      let spf: Buffer;
      try {
        spf = await deps.simulateSkin(now, SPF_SETTINGS, opts);
      } catch (e) {
        if (!(e instanceof YoucamError) || e.kind !== "face_too_small") throw e;
        now = await prepareForSimulation(await cropToCenter(raw, 0.92));
        spf = await deps.simulateSkin(now, SPF_SETTINGS, opts);
      }
      spf = await sharp(spf).jpeg({ quality: 92 }).toBuffer(); // the API returns png
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

import sharp from "sharp";
import { CITATION, INTENSITIES, simSettings, spfDose, type SpfDose } from "./evidence";
import { loadDemo, type FaceId } from "./fixtures";
import { HORIZON_YEARS } from "./horizons";
import { cropToCenter, prepareForAging, prepareForSimulation } from "./image";
import { itaOf } from "./skin-tone";
import { recordedUv, type Uv } from "./uv";
import { ageFace, analyzeSkin, downloadFrame, pickNearest, simulateSkin, YoucamError } from "./youcam";
import type { Opts, SkinAnalysis } from "./youcam";

export const HORIZONS: number[] = [...HORIZON_YEARS];
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
  /** Which recorded demo face; set on demo results only. */
  face?: FaceId;
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
  dose: SpfDose;
  settings: ReturnType<typeof simSettings>;
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

/** Face a keeps the bare url so cached urls stay valid. */
export const demoImageUrl = (name: string, face: FaceId = "a") => `/api/demo-image/${name}${face === "a" ? "" : `?face=${face}`}`;

export function demoResult(uv: Uv | null = recordedUv(), face: FaceId = "a"): FutureResult {
  const imageUrl = (name: string) => demoImageUrl(name, face);
  const d = loadDemo(face);
  const dose = spfDose(uv, d.tone);
  return {
    source: "demo",
    face,
    input: imageUrl("input.jpg"),
    inputAge: d.inputAge,
    frames: d.frames,
    uv,
    horizons: d.horizons.map((h) => {
      const spf = h.spf.find((e) => e.intensity === dose.intensity)!; // spfDose only returns recorded steps
      return {
        years: h.years,
        targetAge: h.targetAge,
        resAge: h.resAge,
        now: { image: imageUrl(h.now.image), ...(h.now.analysis.skinAge ? { skinAge: h.now.analysis.skinAge } : {}) },
        spf: { image: imageUrl(spf.image), ...(spf.analysis.skinAge ? { skinAge: spf.analysis.skinAge } : {}) },
        measured: measuredLine(h.now.analysis, spf.analysis),
      };
    }),
    dose,
    settings: simSettings(dose.intensity),
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
  uv: Uv | null = null,
): Promise<FutureResult> {
  const input = await prepareForAging(selfie).catch(() => {
    throw new YoucamError("decode_failed", "bad_format"); // sharp can't open it (garbage, HEIC)
  });
  const dose = spfDose(uv, await itaOf(input)); // the dose follows the measured tone of the face crop
  const aged = await withCropLadder(input, prepareForAging, (b) => deps.ageFace(b, opts));
  if (aged.inputAge === undefined) throw new YoucamError("no_input_age", "no_face");
  const inputAge = aged.inputAge;

  const horizons = await Promise.all(
    HORIZONS.map(async (years) => {
      const frame = pickNearest(aged.frames, inputAge, years);
      if (!frame) throw new YoucamError("no_frame", "unknown");
      const raw = await deps.downloadFrame(frame.url, opts); // both arms start from this one frame
      // No crop first: the raw frame already holds the whole head. Crop in only if the face is too small.
      const nowArm = await withCropLadder(raw, prepareForSimulation, async (img) => ({
        img,
        a: await deps.analyzeSkin(img, { ...opts, actions: ACTIONS }),
      }));
      const spfArm = await withCropLadder(raw, prepareForSimulation, async (base) => {
        const sim = await deps.simulateSkin(base, simSettings(dose.intensity), opts);
        const img = await sharp(sim).jpeg({ quality: 92 }).toBuffer(); // the API returns png
        return { img, a: await deps.analyzeSkin(img, { ...opts, actions: ACTIONS }) };
      });
      return {
        years,
        targetAge: inputAge + years,
        resAge: frame.resAge,
        now: { image: dataUrl(nowArm.img), ...(nowArm.a.skinAge ? { skinAge: nowArm.a.skinAge } : {}) },
        spf: { image: dataUrl(spfArm.img), ...(spfArm.a.skinAge ? { skinAge: spfArm.a.skinAge } : {}) },
        measured: measuredLine(nowArm.a, spfArm.a),
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
    dose,
    settings: simSettings(dose.intensity),
    citation: CITATION,
  };
}

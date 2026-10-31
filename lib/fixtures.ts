import { readFileSync } from "node:fs";
import path from "node:path";
import type { SkinAnalysis } from "./youcam";

// Reads the recorded demo set: no network, no key.

type Arm = { image: string; analysis: SkinAnalysis };
export type Horizon = {
  years: 20 | 30;
  targetAge: number;
  resAge: number;
  now: Arm;
  /** One render per DOSE_STEPS value: the "now" frame through Skin Simulation at that intensity. */
  spf: (Arm & { intensity: number })[];
};
export type Demo = {
  recordedAt: string;
  source: string;
  inputAge: number;
  frames: number[];
  horizons: Horizon[];
  settings: Record<string, number>;
};

export const DEMO_FACES = ["a", "b"] as const;
export type FaceId = (typeof DEMO_FACES)[number];
export const isFace = (x: unknown): x is FaceId => DEMO_FACES.includes(x as FaceId);

/** Face a lives in fixtures/demo, face b in fixtures/demo-b. */
export const faceDir = (face: FaceId = "a") => {
  if (!isFace(face)) throw new Error("unknown demo face");
  return path.join(process.cwd(), "fixtures", face === "a" ? "demo" : `demo-${face}`);
};

export function loadDemo(face: FaceId = "a"): Demo {
  return JSON.parse(readFileSync(path.join(faceDir(face), "result.json"), "utf8"));
}

/** Absolute path of a recorded image; only input.jpg and images named in that face's result.json resolve. */
export function demoImagePath(name: string, face: FaceId = "a"): string {
  const allowed = ["input.jpg", ...loadDemo(face).horizons.flatMap((h) => [h.now.image, ...h.spf.map((e) => e.image)])];
  if (!allowed.includes(name)) throw new Error("unknown demo image");
  return path.join(faceDir(face), name);
}

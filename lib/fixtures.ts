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

const dir = () => path.join(process.cwd(), "fixtures", "demo");

export function loadDemo(): Demo {
  return JSON.parse(readFileSync(path.join(dir(), "result.json"), "utf8"));
}

/** Absolute path of a recorded image; only input.jpg and images named in result.json resolve. */
export function demoImagePath(name: string): string {
  const allowed = ["input.jpg", ...loadDemo().horizons.flatMap((h) => [h.now.image, ...h.spf.map((e) => e.image)])];
  if (!allowed.includes(name)) throw new Error("unknown demo image");
  return path.join(dir(), name);
}

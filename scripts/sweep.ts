// Usage: bun run sweep -- <image> [more images]
// One AI Aging call per face (~2 units, cached under .sweep/ so a rerun costs 0), then for every frame:
// mean absolute pixel difference vs the frame nearest the input age, and Laplacian variance (texture).
// Both arms use the frame nearest inputAge + years (pickNearest); the SPF arm differs only by Skin Simulation.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { prepareForAging } from "../lib/image";
import { HORIZONS } from "../lib/pipeline";
import { ageFace, downloadFrame, hasYoucamKey, pickNearest, YoucamError } from "../lib/youcam";

const paths = process.argv.slice(2).filter((a) => a !== "--");
if (!paths.length) {
  console.error("usage: bun run sweep -- <image> [more images]");
  process.exit(1);
}
const opts = { timeoutMs: 300_000, intervalMs: 3000 };

type Aged = { inputAge: number; frames: number[] };

async function load(path: string) {
  const input = await prepareForAging(readFileSync(path));
  const dir = `.sweep/${createHash("sha1").update(input).digest("hex").slice(0, 16)}`;
  const meta = `${dir}/aging.json`;
  const file = (resAge: number) => `${dir}/frame-${resAge}.jpg`;
  if (existsSync(meta)) {
    const a: Aged = JSON.parse(readFileSync(meta, "utf8"));
    if (a.frames.every((r) => existsSync(file(r)))) {
      console.log(`  cached (${dir}), 0 units`);
      return { ...a, bytes: (r: number) => readFileSync(file(r)) };
    }
  }
  if (!hasYoucamKey()) throw new Error("YOUCAM_SECRET_KEY is not set (add it to .env)");
  console.log("  AI Aging Generator (~2 units)");
  const aged = await ageFace(input, opts);
  if (aged.inputAge === undefined) throw new Error("aging returned no input age");
  mkdirSync(dir, { recursive: true });
  for (const f of aged.frames) writeFileSync(file(f.resAge), await downloadFrame(f.url, opts));
  const a: Aged = { inputAge: aged.inputAge, frames: aged.frames.map((f) => f.resAge) };
  writeFileSync(meta, JSON.stringify(a, null, 2) + "\n");
  return { ...a, bytes: (r: number) => readFileSync(file(r)) };
}

const SIZE = 512; // every frame is scaled to the same grid before comparing
const gray = (b: Uint8Array) => sharp(b).resize(SIZE, SIZE, { fit: "fill" }).grayscale().raw().toBuffer();

function lapVar(g: Buffer): number {
  let s = 0;
  let s2 = 0;
  let n = 0;
  for (let y = 1; y < SIZE - 1; y++)
    for (let x = 1; x < SIZE - 1; x++) {
      const i = y * SIZE + x;
      const v = g[i - 1] + g[i + 1] + g[i - SIZE] + g[i + SIZE] - 4 * g[i];
      s += v;
      s2 += v * v;
      n++;
    }
  return s2 / n - (s / n) ** 2;
}

const mad = (a: Buffer, b: Buffer) => {
  let t = 0;
  for (let i = 0; i < a.length; i++) t += Math.abs(a[i] - b[i]);
  return t / a.length;
};

async function main() {
  for (const path of paths) {
    console.log(`\n== ${path}`);
    const { inputAge, frames, bytes } = await load(path);
    const grays = new Map<number, Buffer>();
    for (const r of frames) grays.set(r, await gray(bytes(r)));
    const ref = frames.reduce((best, r) => (Math.abs(r - inputAge) < Math.abs(best - inputAge) ? r : best));
    console.log(`inputAge=${inputAge}, reference frame res_age=${ref}`);
    console.log("res_age | mean abs diff vs ref | laplacian var");
    for (const r of frames) {
      const g = grays.get(r)!;
      console.log(`${String(r).padStart(7)} | ${mad(g, grays.get(ref)!).toFixed(2).padStart(20)} | ${lapVar(g).toFixed(1).padStart(13)}`);
    }
    const list = frames.map((resAge) => ({ resAge, url: "" }));
    for (const years of HORIZONS) {
      const frame = pickNearest(list, inputAge, years);
      if (frame) console.log(`+${years}: both arms use res_age=${frame.resAge}, mean pixel diff vs ref ${mad(grays.get(frame.resAge)!, grays.get(ref)!).toFixed(2)}`);
    }
  }
}

main().catch((e) => {
  if (e instanceof YoucamError) console.error(`FAILED: YoucamError code=${e.code} kind=${e.kind}`);
  else console.error(`FAILED: ${e instanceof Error ? e.message : "unknown error"}`);
  process.exit(1);
});

// Measures skin tone (ITA) on each demo face's input.jpg and stores it as tone.json next to result.json.
// Run after changing an input image or the sampling in lib/skin-tone.ts: bun run tone
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DEMO_FACES, faceDir } from "../lib/fixtures";
import { itaOf } from "../lib/skin-tone";

for (const face of DEMO_FACES) {
  const dir = faceDir(face);
  const tone = await itaOf(readFileSync(path.join(dir, "input.jpg")));
  writeFileSync(path.join(dir, "tone.json"), JSON.stringify({ ita: tone.ita }) + "\n");
  console.log(`face ${face}: ITA ${tone.ita} (${tone.band}, x${tone.factor})`);
}

// Builds e2e/fixtures/wide-selfie.jpg: the demo face at ~35% of a 2400x1600 landscape photo, off-centre left,
// on a blurred enlarged copy of itself. The browser test uses it to prove the face-detect crop rescues a small face.
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const SRC = "fixtures/demo/input.jpg"; // 1024x1024, face about 550px wide
const OUT = "e2e/fixtures/wide-selfie.jpg";
const W = 2400;
const H = 1600;
const SIDE = 1560; // 550 * 1560 / 1024 = ~840px = 35% of W
const LEFT = 120;

mkdirSync("e2e/fixtures", { recursive: true });
const background = await sharp(SRC).resize(W, H, { fit: "cover" }).blur(40).modulate({ brightness: 0.9 }).toBuffer();
const face = await sharp(SRC).resize(SIDE, SIDE).toBuffer();
await sharp(background)
  .composite([{ input: face, left: LEFT, top: Math.round((H - SIDE) / 2) }])
  .jpeg({ quality: 90 })
  .toFile(OUT);
console.log(`wrote ${OUT} (${W}x${H})`);

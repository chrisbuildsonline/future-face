// Serve MediaPipe from the app, not a CDN: copy the wasm runtime and fetch the BlazeFace model into public/mediapipe/.
// Runs from package.json "postinstall" (public/mediapipe is git-ignored: the wasm is ~42 MB).
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
const OUT = "public/mediapipe";

mkdirSync(`${OUT}/wasm`, { recursive: true });
cpSync("node_modules/@mediapipe/tasks-vision/wasm", `${OUT}/wasm`, { recursive: true });
console.log(`copied tasks-vision wasm to ${OUT}/wasm`);

const model = `${OUT}/blaze_face_short_range.tflite`;
if (existsSync(model)) {
  console.log(`${model} exists, skipping download`);
} else {
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`model download failed: HTTP ${res.status}`);
  writeFileSync(model, new Uint8Array(await res.arrayBuffer()));
  console.log(`downloaded ${model}`);
}

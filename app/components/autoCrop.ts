// Browser-only: find the face with MediaPipe and crop the photo to it before upload (YouCam wants the face
// at >= 60% of the width). Everything here fails soft: any problem means "upload the original as is".
import type { FaceDetector } from "@mediapipe/tasks-vision";
import { faceCropRect } from "@/lib/face-crop";

// Served by the app (scripts/mediapipe-assets.ts copies them into public/), never from a CDN.
const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/mediapipe/blaze_face_short_range.tflite";
const YOUCAM_MIN_FILL = 0.6;

let detector: Promise<FaceDetector> | null = null;

// The wasm prints TFLite's info lines ("INFO: Created TensorFlow Lite XNNPACK delegate for CPU.") through
// console.error. Drop just those, and only while MediaPipe runs; anything else still reaches the console.
async function quietInfo<T>(run: () => T | Promise<T>): Promise<T> {
  const error = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].startsWith("INFO:")) return;
    error.apply(console, args);
  };
  try {
    return await run();
  } finally {
    console.error = error;
  }
}

function getDetector() {
  if (!detector) {
    detector = quietInfo(async () => {
      // Lazy: the ~14 MB wasm only loads once someone has picked a photo.
      const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
      return FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate: "CPU" },
        runningMode: "IMAGE",
      });
    });
    detector.catch(() => {
      detector = null; // let the next photo try again
    });
  }
  return detector;
}

function croppedName(name: string) {
  const base = name.replace(/\.[^./\\]+$/, "") || "selfie";
  return `${base}-face.jpg`;
}

/** The photo cropped square around its best face, or null to upload the original. Never throws. */
export async function cropToFace(file: File): Promise<File | null> {
  let bitmap: ImageBitmap | null = null;
  try {
    // Upright pixels: EXIF rotation is applied here, so the box and the canvas agree.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const face = await getDetector();
    const image = bitmap;
    const { detections } = await quietInfo(() => face.detect(image));
    const best = detections
      .filter((d) => d.boundingBox)
      .sort((a, b) => (b.categories[0]?.score ?? 0) - (a.categories[0]?.score ?? 0))[0];
    const box = best?.boundingBox;
    // YouCam already takes a face at >= 60% of the width (the demo face reads ~60.5% here), so leave those
    // alone; below that, faceCropRect crops to its 70% target for some margin.
    if (!box || box.width >= YOUCAM_MIN_FILL * bitmap.width) return null;

    const rect = faceCropRect(
      { width: bitmap.width, height: bitmap.height },
      { x: box.originX, y: box.originY, width: box.width, height: box.height },
    );
    if (!rect) return null;

    const canvas = document.createElement("canvas");
    canvas.width = rect.size;
    canvas.height = rect.size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, rect.x, rect.y, rect.size, rect.size, 0, 0, rect.size, rect.size);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) return null;
    return new File([blob], croppedName(file.name), { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}

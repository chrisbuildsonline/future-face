// Browser-only: find the face with MediaPipe and crop the photo to it before upload (YouCam wants the face
// at >= 60% of the width). Everything here fails soft: any problem means "upload the original as is".
import type { FaceDetector } from "@mediapipe/tasks-vision";
import { faceCropRect, YOUCAM_MIN_FILL } from "@/lib/face-crop";

// Served by the app (scripts/mediapipe-assets.ts copies them into public/), never from a CDN.
const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/mediapipe/blaze_face_short_range.tflite";

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

/**
 * face: true when MediaPipe found one, false when it looked and found none, null when it could not look.
 * file: the photo cropped square around the best face, or null to upload the original.
 */
export type FaceCrop = { face: boolean | null; file: File | null };

const asIs = (face: boolean | null): FaceCrop => ({ face, file: null });

/** Finds the face and crops to it. Never throws: any problem means "upload the original as is". */
export async function cropToFace(file: File): Promise<FaceCrop> {
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
    // alone; below that, faceCropRect crops so the box is 60% of the side, with head room for the whole head.
    if (!box) return asIs(false);
    if (box.width >= YOUCAM_MIN_FILL * bitmap.width) return asIs(true);

    const rect = faceCropRect(
      { width: bitmap.width, height: bitmap.height },
      { x: box.originX, y: box.originY, width: box.width, height: box.height },
    );
    if (!rect) return asIs(true);

    const canvas = document.createElement("canvas");
    canvas.width = rect.size;
    canvas.height = rect.size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return asIs(true);
    ctx.drawImage(bitmap, rect.x, rect.y, rect.size, rect.size, 0, 0, rect.size, rect.size);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) return asIs(true);
    return { face: true, file: new File([blob], croppedName(file.name), { type: "image/jpeg", lastModified: Date.now() }) };
  } catch {
    return asIs(null);
  } finally {
    bitmap?.close();
  }
}

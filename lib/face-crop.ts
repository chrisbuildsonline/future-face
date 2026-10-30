type Box = { x: number; y: number; width: number; height: number };

/**
 * Square crop (integers, inside the image) that puts the face at about `fill` of the side.
 * null means upload as is: the image is too small to crop, or the face already fills `fill` of its width.
 * Pure, so the browser can use it.
 */
export function faceCropRect(
  img: { width: number; height: number },
  face: Box,
  fill = 0.7,
  minSize = 480,
): { x: number; y: number; size: number } | null {
  const short = Math.min(img.width, img.height);
  if (short < minSize || face.width >= fill * img.width) return null;
  const size = Math.min(short, Math.max(minSize, Math.round(face.width / fill)));
  const cx = face.x + face.width / 2;
  const cy = face.y + face.height / 2 - face.height * 0.1; // lift the centre so hair and forehead stay in
  const clamp = (v: number, max: number) => Math.min(Math.max(0, Math.round(v)), max);
  return { x: clamp(cx - size / 2, img.width - size), y: clamp(cy - size / 2, img.height - size), size };
}

type Box = { x: number; y: number; width: number; height: number };

/**
 * YouCam wants the face at >= 60% of the width, and it measures the whole head. BlazeFace boxes stop at the
 * eyebrows and chin, so a 0.7 fill left no head room (bad_pose on a live run).
 */
export const YOUCAM_MIN_FILL = 0.6;

/**
 * Square crop (integers, inside the image) that puts the face at about `fill` of the side.
 * null means upload as is: the image is too small to crop, or the face already fills `fill` of its width.
 * Pure, so the browser can use it.
 */
export function faceCropRect(
  img: { width: number; height: number },
  face: Box,
  fill = YOUCAM_MIN_FILL,
  minSize = 480,
): { x: number; y: number; size: number } | null {
  const short = Math.min(img.width, img.height);
  if (short < minSize || face.width >= fill * img.width) return null;
  // tall boxes (height ~1.3x width) need the height term, or forehead/chin get cut off
  const size = Math.min(short, Math.max(minSize, Math.round(Math.max(face.width / fill, face.height * 1.4))));
  // start position along one axis: centred on c, then pushed so the face plus a 10% margin fits when possible
  const place = (c: number, p: number, len: number, max: number) => {
    const lo = Math.ceil(p + len * 1.1 - size);
    const hi = Math.floor(p - len * 0.1);
    const v = Math.round(c - size / 2);
    return Math.min(Math.max(0, lo <= hi ? Math.min(Math.max(v, lo), hi) : v), max);
  };
  const cy = face.y + face.height * 0.4; // centre lifted by 10% of face height so hair and forehead stay in
  return {
    x: place(face.x + face.width / 2, face.x, face.width, img.width - size),
    y: place(cy, face.y, face.height, img.height - size),
    size,
  };
}

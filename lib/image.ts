import sharp from "sharp";

const MAX_BYTES = 10 * 1024 * 1024 - 1024;

// Re-encode as jpg with short side >= minShort (upscale if needed) and long side <= maxLong.
// A too-long panorama favours the long-side cap over the short-side floor.
async function toJpeg(bytes: Uint8Array, minShort: number, maxLong: number): Promise<Buffer> {
  const upright = await sharp(bytes).rotate().toBuffer();
  const { width = 1, height = 1 } = await sharp(upright).metadata();
  const scale = Math.min(Math.max(1, minShort / Math.min(width, height)), maxLong / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  let out = Buffer.alloc(0);
  for (const quality of [92, 80, 65, 50]) {
    out = await sharp(upright).resize(w, h).jpeg({ quality }).toBuffer();
    if (out.length < MAX_BYTES) break;
  }
  return out;
}

export const prepareForSimulation = (bytes: Uint8Array) => toJpeg(bytes, 480, 2560);

// Aging wants both sides >= 320 per the error table (summary only said long side).
export const prepareForAging = (bytes: Uint8Array) => toJpeg(bytes, 320, 4096);

// ponytail: no face detector, so this assumes aged frames are centered portraits and crops the middle.
export async function cropToCenter(bytes: Uint8Array, widthFraction: number): Promise<Buffer> {
  const { width = 1, height = 1 } = await sharp(bytes).metadata();
  const w = Math.max(1, Math.round(width * widthFraction));
  const h = Math.max(1, Math.round(height * widthFraction));
  return sharp(bytes)
    .extract({ left: Math.floor((width - w) / 2), top: Math.floor((height - h) / 2), width: w, height: h })
    .jpeg({ quality: 92 })
    .toBuffer();
}

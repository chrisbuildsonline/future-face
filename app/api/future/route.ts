import { cityErrors, errors } from "@/lib/copy";
import { spfDose } from "@/lib/evidence";
import { isFace } from "@/lib/fixtures";
import { demoResult, runLive } from "@/lib/pipeline";
import { cleanCity, getUv, recordedUv, UvError, type Uv } from "@/lib/uv";
import { hasYoucamKey, YoucamError, type ErrorKind } from "@/lib/youcam";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;
const STATUS_422: ErrorKind[] = ["no_face", "multiple_faces", "face_too_small", "bad_pose", "bad_image_size", "bad_format", "file_too_large", "low_quality"];

// ponytail: per-process ceiling on live runs (LIVE_RUNS_MAX, default 5, ~46 YouCam units each); resets on restart. Add a persistent quota if it matters.
let liveRuns = 0;

const fail = (status: number, kind: ErrorKind) => Response.json({ error: { kind, message: errors[kind] } }, { status });
const cityFail = () => Response.json({ error: { kind: "city_not_found", message: cityErrors.city_not_found } }, { status: 400 });

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const face = params.get("face") ?? "a";
  const faceId = isFace(face) ? face : "a";
  const raw = params.get("city");
  if (raw === null) return Response.json(demoResult(recordedUv(), faceId));
  const city = cleanCity(raw);
  if (!city) return cityFail();
  const uv = await getUv(city).catch(() => recordedUv()); // any UV failure keeps the recorded reading
  return Response.json(demoResult(uv, faceId));
}

export async function POST(req: Request) {
  // ponytail: chunked bodies without Content-Length still get parsed; a proxy body limit covers that.
  if (Number(req.headers.get("content-length")) > MAX_BYTES + 64 * 1024) return fail(413, "file_too_large");
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "bad_format");
  }
  const selfie = form.get("selfie");
  if (!(selfie instanceof File)) return fail(400, "bad_format");
  if (selfie.size > MAX_BYTES) return fail(413, "file_too_large");
  const city = cleanCity(form.get("city"));
  if (!city) return cityFail();

  let uv: Uv;
  try {
    uv = await getUv(city);
  } catch (e) {
    if (e instanceof UvError && e.kind === "city_not_found") return cityFail();
    uv = recordedUv(); // uv_unavailable: dose and uv both fall back to the recorded reading
  }

  if (!hasYoucamKey()) return Response.json({ ...demoResult(uv), notice: errors.no_key });

  if (liveRuns >= Number(process.env.LIVE_RUNS_MAX ?? 5)) return fail(429, "rate_limited");
  liveRuns++;
  try {
    const result = await runLive(new Uint8Array(await selfie.arrayBuffer()), undefined, undefined, spfDose(uv));
    return Response.json({ ...result, uv });
  } catch (e) {
    if (!(e instanceof YoucamError)) return fail(500, "unknown");
    return fail(STATUS_422.includes(e.kind) ? 422 : e.kind === "rate_limited" ? 429 : 503, e.kind);
  }
}

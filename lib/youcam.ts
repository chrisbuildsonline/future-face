import { inflateRawSync } from "node:zlib";

// Server-side only: reads YOUCAM_SECRET_KEY (or YOUCAM_API_KEY).

const DEFAULT_HOST = "https://yce-api-01.makeupar.com";

export const ERROR_KINDS = [
  "no_face",
  "multiple_faces",
  "face_too_small",
  "bad_pose",
  "bad_image_size",
  "bad_format",
  "file_too_large",
  "low_quality",
  "insufficient_units",
  "rate_limited",
  "auth",
  "server_busy",
  "timeout",
  "no_key",
  "unknown",
] as const;
export type ErrorKind = (typeof ERROR_KINDS)[number];

// Every code named in design/api-docs/05, 06 and 07 (engine codes, file-spec codes, 400 error_code values).
export const CODE_TO_KIND: Record<string, ErrorKind> = {
  error_no_face: "no_face",
  error_src_face_too_small: "face_too_small",
  error_face_position_too_small: "face_too_small",
  error_pose: "bad_pose",
  error_src_face_out_of_bound: "bad_pose",
  error_face_position_invalid: "bad_pose",
  error_face_position_out_of_boundary: "bad_pose",
  error_face_not_forward_facing: "bad_pose",
  error_face_angle_upward: "bad_pose",
  error_face_angle_downward: "bad_pose",
  error_face_angle_leftward: "bad_pose",
  error_face_angle_rightward: "bad_pose",
  error_face_angle_left_tilt: "bad_pose",
  error_face_angle_right_tilt: "bad_pose",
  error_below_min_image_size: "bad_image_size",
  error_exceed_max_image_size: "bad_image_size",
  error_decode_image: "bad_format",
  error_decode_mask: "bad_format",
  exceed_max_filesize: "file_too_large",
  error_lighting_dark: "low_quality",
  error_face_parsing: "low_quality",
  error_nsfw_content_detected: "low_quality",
  exceed_nsfw_retry_limits: "low_quality",
  CreditInsufficiency: "insufficient_units",
  error_download_image: "server_busy",
  error_download_mask: "server_busy",
  error_inference: "server_busy",
  error_upload: "server_busy",
  unknown_internal_error: "unknown",
  invalid_parameter: "unknown",
  error_invalid_params: "unknown",
  InvalidParameters: "unknown",
  BadRequest: "unknown",
  InvalidStyleGroup: "unknown",
  InvalidStyle: "unknown",
};

export class YoucamError extends Error {
  constructor(
    public code: string,
    public kind: ErrorKind,
  ) {
    super(kind); // never raw exception text or secrets
    this.name = "YoucamError";
  }
}

function kindForStatus(status: number): ErrorKind {
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server_busy";
  return "unknown";
}

function fail(code: string, status?: number): never {
  throw new YoucamError(code, CODE_TO_KIND[code] ?? (status ? kindForStatus(status) : "unknown"));
}

export type Opts = { fetch?: typeof fetch; intervalMs?: number; timeoutMs?: number };

export function youcamBaseUrl(): string {
  const raw = process.env.YOUCAM_API_URL ?? "";
  try {
    const u = new URL(raw);
    if ((u.protocol === "http:" || u.protocol === "https:") && u.hostname) return raw.replace(/\/+$/, "");
  } catch {}
  return DEFAULT_HOST;
}

// YOUCAM_API_KEY is accepted as another name for YOUCAM_SECRET_KEY, which wins when both are set.
const youcamKey = () => process.env.YOUCAM_SECRET_KEY || process.env.YOUCAM_API_KEY;

export const hasYoucamKey = () => !!youcamKey();

type Json = any;

async function call(path: string, method: "GET" | "POST", body: unknown, opts: Opts): Promise<Json> {
  const key = youcamKey();
  if (!key) throw new YoucamError("no_key", "no_key");
  const f = opts.fetch ?? fetch;
  let res: Response;
  try {
    res = await f(youcamBaseUrl() + path, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return fail("unknown");
  }
  let json: Json = null;
  try {
    json = await res.json();
  } catch {}
  const status = typeof json?.status === "number" && json.status >= 400 ? json.status : res.status;
  if (!res.ok || status >= 400) {
    const code = typeof json?.error_code === "string" ? json.error_code : `http_${status}`;
    return fail(code, status);
  }
  return json;
}

async function fetchBytes(url: string, init: RequestInit, opts: Opts): Promise<Buffer> {
  let res: Response;
  try {
    res = await (opts.fetch ?? fetch)(url, init);
  } catch {
    return fail("unknown");
  }
  if (!res.ok) return fail(`http_${res.status}`, res.status);
  return Buffer.from(await res.arrayBuffer());
}

/** Register, upload the bytes, return file_id. */
async function upload(bytes: Uint8Array, opts: Opts): Promise<string> {
  const png = bytes[0] === 0x89 && bytes[1] === 0x50;
  const type = png ? "image/png" : "image/jpg";
  const reg = await call(
    "/s2s/v2.0/file",
    "POST",
    { files: [{ content_type: type, file_name: png ? "face.png" : "face.jpg", file_size: bytes.length }] },
    opts,
  );
  const file = reg?.data?.files?.[0];
  const req = file?.requests?.[0];
  if (!file?.file_id || !req?.url) return fail("unknown");
  // Presigned url: no bearer header here.
  await fetchBytes(req.url, { method: req.method ?? "PUT", headers: req.headers ?? { "Content-Type": type }, body: new Uint8Array(bytes) }, opts);
  return file.file_id;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Start a task on an uploaded file, poll until done, return data.results. */
async function runTask(kind: string, bytes: Uint8Array, extra: object, opts: Opts): Promise<Json> {
  const fileId = await upload(bytes, opts);
  const start = await call(`/s2s/v2.0/task/${kind}`, "POST", { src_file_id: fileId, ...extra }, opts);
  const taskId = start?.data?.task_id;
  if (!taskId) return fail("unknown");
  const intervalMs = opts.intervalMs ?? 2000;
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const t0 = Date.now();
  for (;;) {
    const poll = await call(`/s2s/v2.0/task/${kind}/${encodeURIComponent(taskId)}`, "GET", undefined, opts);
    const data = poll?.data;
    if (data?.task_status === "success") return data.results;
    if (data?.task_status === "error") return fail(typeof data.error === "string" ? data.error : "unknown");
    if (Date.now() - t0 >= timeoutMs) throw new YoucamError("timeout", "timeout");
    await sleep(intervalMs);
  }
}

// ---- Skin analysis ----

// SD only: never mix SD and HD actions.
const SD_ACTIONS = [
  "wrinkle", "droopy_upper_eyelid", "droopy_lower_eyelid", "firmness", "acne", "moisture", "eye_bag",
  "dark_circle_v2", "age_spot", "radiance", "redness", "oiliness", "pore", "texture", "tear_trough", "skin_type",
];

export type Concern = { raw_score: number; ui_score?: number };
export type SkinAnalysis = { concerns: Record<string, Concern>; skinAge?: number; overall?: number };

/** `actions` picks a subset of SD_ACTIONS (cheaper); default is all 16. */
export async function analyzeSkin(bytes: Uint8Array, opts: Opts & { actions?: string[] } = {}): Promise<SkinAnalysis> {
  const actions = opts.actions ?? SD_ACTIONS;
  if (!actions.length || !actions.every((a) => SD_ACTIONS.includes(a))) throw new YoucamError("invalid_settings", "unknown");
  const results = await runTask("skin-analysis", bytes, { dst_actions: actions, format: "zip" }, opts);
  // Docs show both results.url and results as a bare string.
  const url = typeof results === "string" ? results : results?.url;
  if (!url) return fail("unknown");
  const zip = await fetchBytes(url, { method: "GET" }, opts);
  const files = readZip(zip);
  const name = Object.keys(files).find((n) => n.endsWith("score_info.json"));
  if (!name) return fail("unknown");
  let info: Json;
  try {
    info = JSON.parse(files[name].toString("utf8"));
  } catch {
    return fail("unknown");
  }
  const concerns: Record<string, Concern> = {};
  for (const [k, v] of Object.entries<Json>(info)) {
    if (v && typeof v === "object" && typeof v.raw_score === "number") {
      concerns[k] = { raw_score: v.raw_score, ...(typeof v.ui_score === "number" ? { ui_score: v.ui_score } : {}) };
    }
  }
  return {
    concerns,
    ...(typeof info.skin_age === "number" ? { skinAge: info.skin_age } : {}),
    ...(typeof info.all?.score === "number" ? { overall: info.all.score } : {}),
  };
}

// ---- Aging ----

export type AgingFrame = { resAge: number; url: string };

export async function ageFace(bytes: Uint8Array, opts: Opts = {}): Promise<{ inputAge?: number; frames: AgingFrame[] }> {
  const results = await runTask("aging", bytes, {}, opts);
  const frames: AgingFrame[] = (results?.output ?? [])
    .filter((o: Json) => typeof o?.res_age === "number" && typeof o?.url === "string")
    .map((o: Json) => ({ resAge: o.res_age, url: o.url }));
  return { ...(typeof results?.age === "number" ? { inputAge: results.age } : {}), frames };
}

/** Frame urls expire after 2 hours: download what you need right away. */
export const downloadFrame = (url: string, opts: Opts = {}) => fetchBytes(url, { method: "GET" }, opts);

/** Frame whose res_age is closest to inputAge + years (ties go to the older frame). */
export function pickNearest(frames: AgingFrame[], inputAge: number, years: number): AgingFrame | undefined {
  const target = inputAge + years;
  let best: AgingFrame | undefined;
  for (const f of frames) {
    const d = Math.abs(f.resAge - target);
    const bd = best ? Math.abs(best.resAge - target) : Infinity;
    if (d < bd || (d === bd && f.resAge > best!.resAge)) best = f;
  }
  return best;
}

// ---- Skin simulation ----

const SIM_KEYS = ["wrinkle", "radiance", "oiliness", "acne", "eye_bags", "dark_circle", "spots", "pores", "texture", "redness"] as const;
export type SimSettings = Partial<Record<(typeof SIM_KEYS)[number], number>>;

export async function simulateSkin(bytes: Uint8Array, settings: SimSettings, opts: Opts = {}): Promise<Buffer> {
  const entries = Object.entries(settings);
  const valid =
    entries.every(([k, v]) => (SIM_KEYS as readonly string[]).includes(k) && Number.isFinite(v) && v! >= 0 && v! <= 1) &&
    entries.some(([, v]) => v! > 0);
  if (!valid) throw new YoucamError("invalid_settings", "unknown");
  const results = await runTask("skin-simulation", bytes, settings, opts);
  if (!results?.url) return fail("unknown");
  return fetchBytes(results.url, { method: "GET" }, opts); // url is valid for 2h: take the bytes now
}

// ---- Minimal zip reader (central directory; stored + deflate) ----

export function readZip(zip: Buffer): Record<string, Buffer> {
  const out: Record<string, Buffer> = {};
  try {
    let eocd = -1;
    for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 0xffff); i--) {
      if (zip.readUInt32LE(i) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error("no eocd");
    const count = zip.readUInt16LE(eocd + 10);
    let p = zip.readUInt32LE(eocd + 16);
    for (let n = 0; n < count; n++) {
      if (zip.readUInt32LE(p) !== 0x02014b50) throw new Error("bad cd");
      const method = zip.readUInt16LE(p + 10);
      const size = zip.readUInt32LE(p + 20);
      const nameLen = zip.readUInt16LE(p + 28);
      const extraLen = zip.readUInt16LE(p + 30);
      const commentLen = zip.readUInt16LE(p + 32);
      const local = zip.readUInt32LE(p + 42);
      const name = zip.toString("utf8", p + 46, p + 46 + nameLen);
      const dataStart = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const raw = zip.subarray(dataStart, dataStart + size);
      if (method === 0) out[name] = Buffer.from(raw);
      else if (method === 8) out[name] = inflateRawSync(raw);
      else throw new Error("unsupported method");
      p += 46 + nameLen + extraLen + commentLen;
    }
  } catch {
    return fail("unknown");
  }
  return out;
}

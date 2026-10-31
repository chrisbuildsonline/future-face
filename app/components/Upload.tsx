"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { errors, upload as c } from "@/lib/copy";
import type { FutureResult } from "@/lib/pipeline";
import type { Product } from "@/lib/products";
import { cropToFace } from "./autoCrop";
import { Result } from "./Result";
import s from "./Upload.module.css";

type State =
  | { kind: "idle" }
  | { kind: "loading"; started: number }
  | { kind: "error"; message: string }
  | { kind: "done"; data: FutureResult };

// original = what the person picked; cropped = the face crop, if one was made; useCrop = not undone;
// noFace = MediaPipe looked and found no face (a face that is there but small gets cropped instead).
type Photo = { original: File; cropped: File | null; useCrop: boolean; noFace: boolean };

function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path d="M3 9h11M10 4.5 14.5 9 10 13.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Loading({ started }: { started: number }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => {
      setSecs(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => {
      window.clearInterval(t);
    };
  }, [started]);
  return (
    <div className={s.loading} role="status">
      <span className={s.sun} aria-hidden />
      <p className={s.loadingTitle}>{c.loadingTitle}</p>
      <p className={s.loadingBody}>{c.loading}</p>
      <span className={s.elapsed}>
        {secs}s {c.elapsed}
      </span>
    </div>
  );
}

type UploadProps = {
  catalogue: Product[];
  /** The store product the shopper came from (embed): the result names it and the routine opens on it. */
  product?: Product | null;
  /** Codes the embedding store sells (embed only), passed on to the routine. */
  cart?: string[] | null;
};

export function Upload({ catalogue, product = null, cart = null }: UploadProps) {
  const uid = useId();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [detecting, setDetecting] = useState(false);
  const pickId = useRef(0);
  const file = photo ? (photo.useCrop && photo.cropped) || photo.original : null;
  const [preview, setPreview] = useState<string | null>(null);
  const [city, setCity] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    if (state.kind === "done") {
      resultRef.current?.scrollIntoView({ block: "start" });
    }
  }, [state.kind]);

  async function pick(f: File | null) {
    const id = ++pickId.current;
    setPhoto(f ? { original: f, cropped: null, useCrop: true, noFace: false } : null);
    setDetecting(!!f);
    if (!f) return;
    if (state.kind === "error") setState({ kind: "idle" }); // a new photo starts over
    const { face, file: cropped } = await cropToFace(f);
    if (id !== pickId.current) return; // a newer photo was picked meanwhile
    setPhoto({ original: f, cropped, useCrop: true, noFace: face === false });
    setDetecting(false);
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file || detecting || photo?.noFace || !city.trim()) return;
    setState({ kind: "loading", started: Date.now() });
    const body = new FormData();
    body.set("selfie", file);
    body.set("city", city.trim());
    try {
      const res = await fetch("/api/future", { method: "POST", body });
      const json = await res.json().catch(() => null);
      if (res.ok && Array.isArray(json?.horizons)) setState({ kind: "done", data: json });
      else setState({ kind: "error", message: json?.error?.message ?? errors.unknown });
    } catch {
      setState({ kind: "error", message: errors.unknown });
    }
  }

  if (state.kind === "done") {
    return (
      <div ref={resultRef} className={s.done} data-testid="upload-result">
        <Result data={state.data} titleTag="h2" catalogue={catalogue} product={product} cart={cart} />
        <button type="button" className={s.secondary} onClick={() => setState({ kind: "idle" })}>
          {c.fileChange}
        </button>
      </div>
    );
  }

  const busy = state.kind === "loading";
  const fileId = `${uid}-file`;
  const hintId = `${uid}-hint`;
  const cropped = !detecting && photo?.cropped ? photo : null;
  const noFace = !detecting && photo?.noFace;
  const statusText = detecting ? c.cropFinding : cropped ? (cropped.useCrop ? c.cropDone : c.cropFull) : "";
  const statusTone = detecting ? "busy" : cropped ? (cropped.useCrop ? "accent" : "neutral") : undefined;
  return (
    <form className={s.card} onSubmit={submit} aria-busy={busy}>
      <input
        id={fileId}
        className={s.fileInput}
        type="file"
        accept="image/jpeg,image/png"
        aria-describedby={hintId}
        disabled={busy}
        onChange={(e) => void pick(e.target.files?.[0] ?? null)}
      />
      <div className={s.dropWrap}>
        <label
          htmlFor={fileId}
          className={s.drop}
          data-filled={preview ? "" : undefined}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f && !busy) void pick(f);
          }}
        >
          {preview ? (
            <>
              {/* The whole photo as sent (contain), over a soft blurred copy that fills the tile. */}
              <img src={preview} alt="" className={s.backdrop} aria-hidden />
              <img src={preview} alt="" className={s.preview} data-testid="upload-preview" />
            </>
          ) : (
            <span className={s.plus} aria-hidden />
          )}
          <span className={s.dropTitle}>{file ? c.fileChange : c.file}</span>
          <span id={hintId} className={s.dropHint}>
            {file ? file.name : c.fileHint}
          </span>
        </label>
        {/* A sibling of the label, not a child: a button inside a label is invalid and would open the picker.
            Always mounted so screen readers hear each change in the polite live region. */}
        <div className={s.status} data-tone={statusTone}>
          <span className={s.statusText} role="status" aria-live="polite">
            {statusText}
          </span>
          {cropped ? (
            <button
              type="button"
              className={s.statusAction}
              disabled={busy}
              onClick={() => setPhoto({ ...cropped, useCrop: !cropped.useCrop })}
            >
              {cropped.useCrop ? c.cropUndo : c.cropAgain}
            </button>
          ) : null}
        </div>
      </div>

      <div className={s.side}>
        {busy ? (
          <Loading started={state.started} />
        ) : (
          <>
            <label className={s.field}>
              <span className={s.fieldLabel}>{c.city}</span>
              <input
                className={s.input}
                list={`${uid}-cities`}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={c.cityPlaceholder}
                autoComplete="address-level2"
                maxLength={80}
              />
              <datalist id={`${uid}-cities`}>
                {c.cities.map((x) => (
                  <option key={x} value={x} />
                ))}
              </datalist>
            </label>
            {noFace ? (
              <p className={s.error} role="alert">
                <span className={s.errorText}>
                  <b>{c.noFace}</b>
                  {c.noFaceHint}
                </span>
              </p>
            ) : null}
            {state.kind === "error" ? (
              <p className={s.error} role="alert">
                {state.message}
              </p>
            ) : null}
            <button type="submit" className={s.cta} disabled={!file || detecting || noFace || !city.trim()}>
              <span>{c.submit}</span>
              <span className={s.ctaIcon}>
                <Arrow />
              </span>
            </button>
          </>
        )}
      </div>
    </form>
  );
}

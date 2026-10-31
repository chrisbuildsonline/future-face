"use client";

import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { landing, result as c, routine as rc } from "@/lib/copy";
import { defaultYears, HORIZON_YEARS } from "@/lib/horizons";
import type { FutureResult } from "@/lib/pipeline";
import type { Uv } from "@/lib/uv";
import { uvBand } from "@/lib/uv-band";
import { CompareSlider } from "./CompareSlider";
import t from "./CompareSlider.module.css";
import s from "./Result.module.css";
import { productLabel, type Product } from "@/lib/products";
import { routineFor, type Concerns } from "@/lib/routine";
import { TONE_ASSUMPTION, TONE_CITATIONS, toneSwatch } from "@/lib/tone";
import { Arrow, Routine } from "./Routine";
import r from "./Routine.module.css";

type Horizon = FutureResult["horizons"][number];

/** The model's "as you live now" readings for spots, wrinkle and texture; null unless all three were read. */
function concernsOf(h: Horizon): Concerns | null {
  const now = (key: string) => h.measured.find((m) => m.key === key)?.now;
  const [spots, wrinkle, texture] = [now("spots"), now("wrinkle"), now("texture")];
  return spots === undefined || wrinkle === undefined || texture === undefined ? null : { spots, wrinkle, texture };
}

const one = (n: number) => n.toFixed(1);
const pct = (n: number) => Math.max(0, Math.min(100, n));
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toFixed(1)}`;
const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * True while the bar's box overlaps the figure's box on screen: on a phone the routine bar is sticky to the
 * bottom of the viewport, and it must never sit on the slider. Layout effect, so the first paint is right.
 */
function useCovering(bar: RefObject<HTMLElement | null>, figure: RefObject<HTMLElement | null>) {
  const [covering, setCovering] = useState(false);
  useLayoutEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;
      const a = bar.current?.getBoundingClientRect();
      const b = figure.current?.getBoundingClientRect();
      setCovering(Boolean(a && b && a.height > 0 && a.top < b.bottom && b.top < a.bottom));
    };
    const queue = () => {
      raf ||= requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
    };
  }, [bar, figure]);
  return covering;
}

type CompareProps = {
  h: Horizon;
  label: string;
  dose: FutureResult["dose"];
  citation: FutureResult["citation"];
  ref: RefObject<HTMLElement | null>;
};

function Compare({ h, label, dose, citation, ref }: CompareProps) {
  return (
    <figure ref={ref} className={`${s.card} ${s.compare}`}>
      <CompareSlider now={h.now.image} spf={h.spf.image} label={label} className={s.compareFrame} />
      <figcaption className={s.caption}>
        <span className={s.shared}>
          <span className={s.sharedArms}>
            <span className={s.sharedDots} aria-hidden />
            {c.frame.both}
          </span>
          <b data-testid="frame-age">
            {c.frame.age} {h.resAge}
          </b>
        </span>
        <strong>{c.disclaimer}</strong>
        <span>
          {c.frame.target} {h.targetAge}. {c.frame.nearest} {c.frame.method}
        </span>
        <Dose dose={dose} citation={citation} />
      </figcaption>
    </figure>
  );
}

/** 1 -> "1.0", 1.28 -> "1.28", 0.75 -> "0.75": a factor at its own precision, never "1". */
const factorText = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));
const itaText = (ita: number) => `${ita.toFixed(1).replace("-", "−")}°`;

/**
 * The SPF face's Skin Simulation intensity: the inputs as tiles (both UV readings and the measured skin tone), then
 * one line of arithmetic, 0.24 x (UV ratio x tone factor, rounded to the nearest 0.5) = intensity.
 */
function Dose({ dose, citation }: { dose: FutureResult["dose"]; citation: FutureResult["citation"] }) {
  const d = c.dose;
  const trial = (dose.intensity / dose.ratio).toFixed(2); // 0.24: the ratio is what the city and the tone change
  const [cityUv, refUv, ratio, intensity] = [dose.cityUv.toFixed(1), dose.referenceUv.toFixed(1), dose.ratio.toFixed(1), dose.intensity.toFixed(2)];
  const uvRatio = factorText(dose.uvRatio);
  const tone = dose.tone;
  const factor = factorText(tone?.factor ?? 1);
  const band = tone ? d.bands[tone.band] : d.notMeasured;
  const ita = tone ? `ITA ${itaText(tone.ita)}` : null;
  const refLabel = `${dose.referenceCity}, ${d.trialSite}`;
  const toneSr = tone ? `${d.sentenceTone} ${factor} for ${band} ${d.sentenceSkin}, ${ita}` : `${d.sentenceTone} ${factor}, ${band}`;
  const cite = (href: string, label: string, title: string) => (
    <a className={s.doseCite} href={href} target="_blank" rel="noreferrer" title={title}>
      {label}
      <span aria-hidden> ↗</span>
    </a>
  );
  return (
    <span className={s.dose} data-testid="dose">
      <span className={s.doseTop}>
        <span className={`${s.pill} ${s.pillAccent}`}>{d.api}</span>
        <span className={s.doseEyebrow}>{d.eyebrow}</span>
      </span>
      <span className={s.srOnly} data-testid="dose-sentence">
        {`${d.sentence} ${trial} × (UV ${cityUv} in ${dose.cityName} / UV ${refUv} in ${refLabel} = ${uvRatio}, × ${toneSr}, ${d.rounded}: ${ratio}) = ${intensity}`}
      </span>
      <span className={s.doseTiles} aria-hidden>
        <span className={s.doseTile}>
          <small>
            {d.cityUv} {dose.cityName}
          </small>
          <b data-testid="dose-city-uv">{cityUv}</b>
        </span>
        <span className={s.doseTile}>
          <small>
            {d.refUv} {refLabel}
          </small>
          <b data-testid="dose-ref-uv">{refUv}</b>
        </span>
        <span className={`${s.doseTile} ${s.toneTile}`} data-testid="dose-tone">
          <small>{d.tone}</small>
          <span className={s.toneValue}>
            {tone ? (
              <span className={s.swatch} style={{ background: toneSwatch(tone.ita) }} data-testid="dose-tone-swatch" />
            ) : (
              <span className={`${s.swatch} ${s.swatchNone}`} />
            )}
            <b data-testid="dose-tone-factor">×{factor}</b>
          </span>
          <span className={s.toneMeta}>
            <span data-testid="dose-tone-band">{band}</span>
            {ita ? <span data-testid="dose-tone-ita">{ita}</span> : null}
          </span>
        </span>
      </span>
      <span className={s.formula} aria-hidden>
        <span className={s.group}>
          <span className={s.term}>
            <b data-testid="dose-trial">{trial}</b>
            <small>{d.trial}</small>
          </span>
          <span className={s.op}>×</span>
        </span>
        <span className={s.group}>
          <span className={s.paren}>(</span>
          <span className={s.term}>
            <b data-testid="dose-uv-ratio">{uvRatio}</b>
            <small>{d.uvRatio}</small>
          </span>
          <span className={s.op}>×</span>
          <span className={s.term}>
            <b data-testid="dose-factor">{factor}</b>
            <small>{d.toneShort}</small>
          </span>
          <span className={s.paren}>)</span>
        </span>
        <span className={s.group}>
          <span className={s.op}>≈</span>
          <span className={`${s.term} ${s.termRounded}`}>
            <b data-testid="dose-ratio">{ratio}</b>
            <small data-testid="dose-rounded-label">{d.rounded}</small>
          </span>
          <span className={s.op}>=</span>
          <span className={`${s.term} ${s.termResult}`}>
            <b data-testid="dose-intensity">{intensity}</b>
            <small>{d.intensity}</small>
          </span>
        </span>
      </span>
      <span className={s.doseFoot}>
        <span className={s.doseCites}>
          <span className={s.doseSources}>{d.sources}</span>
          {cite(`https://doi.org/${citation.doi}`, d.cite, citation.text)}
          {cite(`https://doi.org/${TONE_CITATIONS.chardon.doi}`, d.citeTone, TONE_CITATIONS.chardon.text)}
          {cite(`https://doi.org/${TONE_CITATIONS.kaidbey.doi}`, d.citeMelanin, TONE_CITATIONS.kaidbey.text)}
        </span>
        <span className={s.assumption}>{TONE_ASSUMPTION}</span>
      </span>
    </span>
  );
}

function Citation({ id, value, citation }: { id: string; value: number; citation: FutureResult["citation"] }) {
  const href = `https://doi.org/${citation.doi}`;
  return (
    <div popover="auto" id={id} className={s.popover}>
      <span className={`${s.pill} ${s.pillAccent}`}>
        {c.citation.eyebrow} · {value}
      </span>
      <p className={s.popStat}>
        <span className={s.popNum}>{c.citation.stat}</span>
        <span>{c.citation.statLabel}</span>
      </p>
      <p className={s.popBody}>{citation.finding}</p>
      <p className={s.popBody}>{c.citation.how}</p>
      <p className={s.popCite}>{citation.text}</p>
      <a className={s.popLink} href={href} target="_blank" rel="noreferrer">
        {c.citation.link} <span className={s.doi}>{`${c.citation.doiLabel}:${citation.doi}`}</span>
      </a>
    </div>
  );
}

function Measured({ h, settings, citation }: { h: Horizon; settings: FutureResult["settings"]; citation: FutureResult["citation"] }) {
  const uid = useId();
  const order: readonly string[] = c.measured.order;
  const rows = [...h.measured].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  return (
    <article className={`${s.card} ${s.measured}`} aria-labelledby={`${uid}-m`}>
      <div className={s.cardTop}>
        <span className={`${s.pill} ${s.pillAccent}`}>{c.measured.eyebrow}</span>
        <span className={`${s.pill} ${s.pillNeutral}`}>{c.measured.higher}</span>
      </div>
      <h3 id={`${uid}-m`} className={s.cardTitle}>
        {c.measured.title}
      </h3>
      <p className={s.legend} aria-hidden>
        <span className={s.keyNow}>{c.slider.left}</span>
        <span className={s.keySpf}>{c.slider.right}</span>
      </p>
      <ul className={s.rows}>
        {rows.map((m) => {
          const label = c.measured.labels[m.key] ?? m.key;
          const value = (settings as Record<string, number>)[m.key];
          const popId = `${uid}-cite-${m.key}`;
          const anchor = `--cite-${m.key}-${uid.replace(/[^a-zA-Z0-9]/g, "")}`;
          return (
            <li key={m.key} className={s.row} style={{ "--anchor": anchor } as CSSProperties}>
              <div className={s.rowHead}>
                <span className={s.rowLabel}>{label}</span>
                <span className={`${s.pill} ${s.pillAccent} ${s.delta}`}>{signed(m.delta)}</span>
              </div>
              <p className={s.numbers}>
                <span className={s.srOnly}>{c.slider.left}</span>
                <span data-testid={`measured-${m.key}-now`} className={s.numNow}>
                  {one(m.now)}
                </span>
                <span className={s.arrow} aria-hidden>
                  →
                </span>
                <span className={s.srOnly}>{c.slider.right}</span>
                <span data-testid={`measured-${m.key}-spf`} className={s.numSpf}>
                  {one(m.spf)}
                </span>
              </p>
              <span className={s.bars} aria-hidden>
                <span className={s.barNow} style={{ "--w": `${pct(m.now)}%` } as CSSProperties} />
                <span className={s.barSpf} style={{ "--w": `${pct(m.spf)}%` } as CSSProperties} />
              </span>
              {value !== undefined && (
                <div className={s.rowTools}>
                  <span className={`${s.pill} ${s.pillNeutral}`}>
                    {c.measured.intensity} <b className={s.intensityValue}>{value}</b>
                  </span>
                  <button type="button" className={s.source} popoverTarget={popId} aria-label={`${c.measured.source}, ${label} ${value}`}>
                    <span className={s.sourceDot} aria-hidden>
                      i
                    </span>
                    {c.measured.source}
                  </button>
                  <Citation id={popId} value={value} citation={citation} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className={s.foot}>{c.measured.foot}</p>
    </article>
  );
}

function Closeup({ h }: { h: Horizon }) {
  return (
    <article className={`${s.card} ${s.closeup}`}>
      <div className={s.cardTop}>
        <span className={`${s.pill} ${s.pillNeutral}`}>{c.closeup.eyebrow}</span>
      </div>
      <h3 className={s.cardTitle}>{c.closeup.title}</h3>
      <p className={s.cardLead}>{c.closeup.lead}</p>
      <div className={s.zooms}>
        {[
          { src: h.now.image, tag: c.slider.left, cls: t.tagLeft },
          { src: h.spf.image, tag: c.slider.right, cls: t.tagRight },
        ].map((z) => (
          <div key={z.tag} className={s.zoom}>
            <img data-testid="closeup" src={z.src} alt={`${z.tag}, ${c.closeup.eyebrow}`} />
            <span className={`${t.tag} ${z.cls} ${s.zoomTag}`} aria-hidden>
              {z.tag}
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}

const ARC = { cx: 100, cy: 98, r: 80 };
function pt(share: number) {
  const a = Math.PI * (1 - share);
  return { x: +(ARC.cx + ARC.r * Math.cos(a)).toFixed(2), y: +(ARC.cy - ARC.r * Math.sin(a)).toFixed(2) };
}
const arc = (from: number, to: number) => {
  const a = pt(from);
  const b = pt(to);
  return `M ${a.x} ${a.y} A ${ARC.r} ${ARC.r} 0 0 1 ${b.x} ${b.y}`;
};

function UvCard({ uv }: { uv: Uv }) {
  const uid = useId();
  const band = uvBand(uv.uvMax);
  const share = Math.max(0, Math.min(uv.uvMax / 11, 1));
  const sun = pt(share);
  const gradId = `${uid}-uvg`;
  return (
    <article className={`${s.card} ${s.uv}`} aria-labelledby={`${uid}-uv`}>
      <div className={s.cardTop}>
        <span className={`${s.pill} ${s.pillNeutral}`}>{c.uv.eyebrow}</span>
        <span className={s.uvSource}>{uv.source === "live" ? c.uv.live : c.uv.recorded}</span>
      </div>
      <div className={s.gaugeWrap}>
        <svg className={s.gauge} viewBox="0 0 200 112" aria-hidden>
          <defs>
            <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" className={s.stopA} />
              <stop offset="1" className={s.stopB} />
            </linearGradient>
          </defs>
          <path d={arc(0, 1)} className={s.gaugeTrack} />
          {share > 0.005 && <path d={arc(0, share)} className={s.gaugeFill} stroke={`url(#${gradId})`} />}
          <circle cx={sun.x} cy={sun.y} r="11" className={s.sunOuter} />
          <circle cx={sun.x} cy={sun.y} r="5" className={s.sunInner} />
        </svg>
        <div className={s.uvValue}>
          <span className={s.uvNum}>{uv.uvMax.toFixed(1)}</span>
          <span className={`${s.pill} ${band === "low" || band === "moderate" ? s.pillGood : s.pillWatch}`}>{c.uv.bands[band]}</span>
        </div>
        <span className={s.scale} aria-hidden>
          <span>{c.uv.scaleLow}</span>
          <span>{c.uv.scaleHigh}</span>
        </span>
      </div>
      <h3 id={`${uid}-uv`} className={s.uvCity}>
        {uv.city}
        {uv.country ? <span>, {uv.country}</span> : null}
      </h3>
      <p className={s.uvMeta}>
        {c.uv.peak} · <time dateTime={uv.date}>{day.format(new Date(`${uv.date}T00:00:00Z`))}</time>
      </p>
      <p className={s.attribution}>
        <a href={c.uv.attributionUrl} target="_blank" rel="noreferrer">
          {c.uv.attribution}
        </a>{" "}
        · CC BY 4.0
      </p>
    </article>
  );
}

/** One recorded demo face: a real link to /result?face=<id> with the page's other params kept. */
export type FaceLink = { id: string; href: string; src: string };

/** Round avatar links between the recorded demo faces; the selected one wears the accent ring. */
function FaceSwitch({ faces, current }: { faces: FaceLink[]; current: string }) {
  const uid = useId();
  return (
    <div className={s.faces} role="group" aria-labelledby={`${uid}-f`}>
      <span id={`${uid}-f`} className={s.facesLabel}>
        {c.eyebrow.demo}
      </span>
      {faces.map((f) => (
        <Link
          key={f.id}
          href={f.href}
          scroll={false}
          className={s.faceLink}
          aria-label={c.faces[f.id] ?? f.id}
          aria-current={f.id === current ? "true" : undefined}
        >
          <img src={f.src} alt="" />
        </Link>
      ))}
    </div>
  );
}

type CityChipsProps = {
  names: string[];
  picked: string;
  busy: string | null;
  line: string;
  failed: boolean;
  onPick: (name: string) => void;
};

/** Demo only: the recorded city first, then a few others; one tap re-reads the dose at that city's UV today. */
function CityChips({ names, picked, busy, line, failed, onPick }: CityChipsProps) {
  const uid = useId();
  return (
    <div className={s.cities}>
      <div className={s.cityGroup} role="group" aria-labelledby={`${uid}-c`}>
        <span id={`${uid}-c`} className={s.citiesLabel}>
          {c.cities.label}
        </span>
        {names.map((n) => (
          <button
            key={n}
            type="button"
            className={s.cityChip}
            aria-pressed={n === picked}
            aria-busy={n === busy || undefined}
            onClick={() => onPick(n)}
          >
            {n}
          </button>
        ))}
      </div>
      {/* one slot: the status line, or the error in its place (the status stays mounted as the live region) */}
      <div className={s.cityLine}>
        <p className={s.cityStatus} role="status" data-testid="city-status" data-hidden={failed ? "" : undefined}>
          {line}
        </p>
        {failed ? (
          <p className={s.cityError} role="alert">
            {c.cities.error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

type ResultProps = {
  data: FutureResult;
  /** The recorded demo faces to switch between; shown on demo results only. */
  faces?: FaceLink[] | null;
  titleTag?: "h1" | "h2";
  catalogue: Product[];
  /** A product picked on a store page: shown first, and the routine opens with it as the morning step. */
  product?: Product | null;
  cart?: string[] | null;
};

export function Result({ data: initial, faces = null, titleTag: Title = "h1", catalogue, product = null, cart = null }: ResultProps) {
  const uid = useId();
  // City chips (demo only): `data` is the result on screen, the recorded one until a city swaps it in.
  // Result is keyed by face where it is rendered, so a face switch starts over from the recorded result.
  const recordedCity = initial.uv?.city ?? "";
  const [data, setData] = useState(initial);
  const [picked, setPicked] = useState(recordedCity);
  const [busyCity, setBusyCity] = useState<string | null>(null);
  const [cityLine, setCityLine] = useState<string>(c.cities.hint);
  const [cityFailed, setCityFailed] = useState(false);
  const latestTap = useRef(0);
  const cityCache = useRef(new Map<string, FutureResult>());
  const [years, setYears] = useState(() => defaultYears(data.horizons));
  const [routineOpen, setRoutineOpen] = useState(Boolean(product));
  const routineHead = useRef<HTMLHeadingElement>(null);
  const routineId = `${uid}-routine`;
  const clicked = useRef(false);
  const fit = product && data.uv ? routineFor(data.uv.uvMax, catalogue, product.code).fit : null;

  // Opening the routine by its button moves focus (and the view) to its heading; a preselected one just sits below.
  useEffect(() => {
    if (routineOpen && clicked.current) {
      routineHead.current?.focus({ preventScroll: true });
      routineHead.current?.scrollIntoView({ block: "start" });
    }
  }, [routineOpen]);

  const figureRef = useRef<HTMLElement>(null);
  const nextRef = useRef<HTMLDivElement>(null);
  const covering = useCovering(nextRef, figureRef);

  const h = data.horizons.find((x) => x.years === years) ?? data.horizons.find((x) => x.years === defaultYears(data.horizons));
  if (!h) return null;
  const labelOf = (y: number) => landing.visual.horizon[(HORIZON_YEARS as readonly number[]).indexOf(y)] ?? `+${y} yrs`;
  // only the horizons this face has recorded: nothing to tap that leads nowhere
  const offered = data.horizons.map((x) => x.years).sort((a, b) => a - b);
  const switcher = data.source === "demo" && faces?.length ? faces : null;
  // the shown horizon's "as you live now" readings steer the routine's morning pick
  const concerns = concernsOf(h);

  const cityNames =
    initial.source === "demo" && initial.uv
      ? [recordedCity, ...c.cities.names.filter((n) => n.toLowerCase() !== recordedCity.toLowerCase())]
      : null;

  // "Lima · UV 9.9 → same dose step (0.24)" or "London · UV 1.0 → dose 0.12", against the result shown before
  const showCity = (name: string, next: FutureResult) => {
    const dose = next.dose.intensity.toFixed(2);
    const uv = (next.uv?.uvMax ?? next.dose.cityUv).toFixed(1);
    const same = next.dose.intensity === data.dose.intensity;
    setCityLine(`${name} · UV ${uv} → ${same ? `${c.cities.same} (${dose})` : `${c.cities.dose} ${dose}`}`);
    setData(next);
    setPicked(name);
    setBusyCity(null);
    setCityFailed(false);
  };

  const pickCity = async (name: string) => {
    if (name === picked && busyCity === null) return;
    const tap = ++latestTap.current; // only the latest tap wins; an older response that lands late is dropped
    if (name === recordedCity) return showCity(name, initial);
    const cached = cityCache.current.get(name);
    if (cached) return showCity(name, cached);
    setBusyCity(name);
    try {
      const res = await fetch(`/api/future?face=${encodeURIComponent(initial.face ?? "a")}&city=${encodeURIComponent(name)}`);
      const next: FutureResult | null = res.ok ? await res.json() : null;
      if (tap !== latestTap.current) return;
      if (!next || !Array.isArray(next.horizons)) throw new Error("city failed");
      if (next.uv?.source !== "live") {
        // the route fell back to the recorded reading: say so, and show the recorded result under its own chip
        setData(initial);
        setPicked(recordedCity);
        setBusyCity(null);
        setCityFailed(false);
        setCityLine(`${name}: ${c.cities.noLive} ${recordedCity} ${c.cities.noLiveTail}`);
        return;
      }
      cityCache.current.set(name, next);
      showCity(name, next);
    } catch {
      if (tap !== latestTap.current) return;
      setBusyCity(null);
      setCityFailed(true); // the previous result and selection stay
    }
  };

  const openRoutine = () => {
    clicked.current = true;
    if (!routineOpen) {
      setRoutineOpen(true);
      return;
    }
    routineHead.current?.focus({ preventScroll: true });
    routineHead.current?.scrollIntoView({ block: "start" });
  };

  return (
    <>
    <section className={s.result} aria-labelledby={`${uid}-t`}>
      <header className={s.head}>
        <div className={s.headCopy}>
          <div className={s.meta}>
            {switcher ? (
              <FaceSwitch faces={switcher} current={data.face ?? "a"} />
            ) : (
              <span className={`${s.pill} ${data.source === "demo" ? s.pillNeutral : s.pillAccent}`}>
                {data.source === "demo" ? c.eyebrow.demo : c.eyebrow.live}
              </span>
            )}
            <span className={s.today}>
              {data.input && !switcher ? <img src={data.input} alt="" className={s.avatar} /> : null}
              <span className={s.todayLabel}>{c.today}</span>
              <b className={s.todayAge}>{data.inputAge}</b>
            </span>
            {data.uv ? (
              <span className={`${s.pill} ${s.pillNeutral} ${s.uvPill}`} data-testid="uv-pill">
                {data.uv.city} · UV {data.uv.uvMax.toFixed(1)}
              </span>
            ) : null}
          </div>
          <Title id={`${uid}-t`} className={s.title}>
            {c.titlePrefix} {h.years} {c.titleYears} <em>{c.titleAccent}</em>
          </Title>
          <p className={s.lead}>{c.lead}</p>
          {product ? (
            <p className={s.withChip} data-testid="with-product">
              {product.image ? <img src={product.image} alt="" className={s.withThumb} /> : <span className={s.withDot} aria-hidden />}
              <span className={s.withText}>
                {rc.with} <b>{productLabel(product)}</b>
              </span>
              {fit ? <span className={`${s.pill} ${fit.ok ? s.pillGood : s.pillWatch}`}>{fit.line}</span> : null}
            </p>
          ) : null}
        </div>
        <div className={s.horizonWrap}>
          <span className={s.horizonLabel} id={`${uid}-hz`}>
            {c.horizonLabel}
          </span>
          {offered.length > 1 ? (
            <div className={s.segmented} role="group" aria-labelledby={`${uid}-hz`}>
              {offered.map((y) => (
                <button key={y} type="button" className={s.segment} aria-pressed={y === h.years} onClick={() => setYears(y)}>
                  {labelOf(y)}
                </button>
              ))}
            </div>
          ) : (
            // one recorded horizon: a plain neutral pill (DESIGN.md status table, "+20 yrs"), not a one-button control
            <span className={`${s.pill} ${s.pillNeutral} ${s.horizonStatic}`} aria-describedby={`${uid}-hz`} data-testid="horizon-static">
              {labelOf(h.years)}
            </span>
          )}
        </div>
      </header>

      {data.notice ? (
        <p className={s.notice} role="status">
          <span className={s.noticeDot} aria-hidden />
          {data.notice}
        </p>
      ) : null}

      {cityNames ? (
        <CityChips names={cityNames} picked={picked} busy={busyCity} line={cityLine} failed={cityFailed} onPick={pickCity} />
      ) : null}

      <div className={s.grid}>
        <Compare ref={figureRef} h={h} label={labelOf(h.years)} dose={data.dose} citation={data.citation} />
        <Measured h={h} settings={data.settings} citation={data.citation} />
        <Closeup h={h} />
        {data.uv ? <UvCard uv={data.uv} /> : null}
      </div>

      {data.uv ? (
        <div ref={nextRef} className={s.next} data-covering={covering ? "" : undefined}>
          <p className={s.nextNote}>{catalogue.some((p) => p.source === "generic") ? rc.ctaNoteGeneric : rc.ctaNote}</p>
          <button
            type="button"
            className={`${r.cta} ${s.nextCta}`}
            aria-expanded={routineOpen}
            aria-controls={routineId}
            onClick={openRoutine}
          >
            <span>{rc.cta}</span>
            <span className={r.ctaIcon}>
              <Arrow />
            </span>
          </button>
        </div>
      ) : null}
    </section>
    {routineOpen && data.uv ? (
      <Routine id={routineId} uv={data.uv} headingRef={routineHead} catalogue={catalogue} prefer={product?.code} concerns={concerns} cart={cart} />
    ) : null}
    </>
  );
}

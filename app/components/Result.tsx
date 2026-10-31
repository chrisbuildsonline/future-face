"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { landing, result as c, routine as rc } from "@/lib/copy";
import type { FutureResult } from "@/lib/pipeline";
import type { Uv } from "@/lib/uv";
import { uvBand } from "@/lib/uv-band";
import { CompareSlider } from "./CompareSlider";
import t from "./CompareSlider.module.css";
import s from "./Result.module.css";
import { productLabel, type Product } from "@/lib/products";
import { routineFor } from "@/lib/routine";
import { Arrow, Routine } from "./Routine";
import r from "./Routine.module.css";

type Horizon = FutureResult["horizons"][number];

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

/** The SPF face's Skin Simulation intensity as an annotated formula: 0.24 x (city UV / Nambour UV, rounded) = intensity. */
function Dose({ dose, citation }: { dose: FutureResult["dose"]; citation: FutureResult["citation"] }) {
  const d = c.dose;
  const trial = (dose.intensity / dose.ratio).toFixed(2); // 0.24: the ratio is what the city changes
  const [cityUv, refUv, ratio, intensity] = [dose.cityUv.toFixed(1), dose.referenceUv.toFixed(1), dose.ratio.toFixed(1), dose.intensity.toFixed(2)];
  const refLabel = `${dose.referenceCity}, ${d.trialSite}`;
  return (
    <span className={s.dose} data-testid="dose">
      <span className={s.doseTop}>
        <span className={`${s.pill} ${s.pillAccent}`}>{d.api}</span>
        <span className={s.doseEyebrow}>{d.eyebrow}</span>
        <a className={s.doseCite} href={`https://doi.org/${citation.doi}`} target="_blank" rel="noreferrer">
          {d.cite}
          <span aria-hidden> ↗</span>
        </a>
      </span>
      <span className={s.srOnly} data-testid="dose-sentence">
        {`${d.sentence} ${trial} × (UV ${cityUv} in ${dose.cityName} / UV ${refUv} in ${refLabel}, ${d.sentenceRounded} ${ratio}) = ${intensity}`}
      </span>
      <span className={s.formula} aria-hidden>
        <span className={s.group}>
          <span className={s.term}>
            <b data-testid="dose-trial">{trial}</b>
            <small>{d.trial}</small>
          </span>
          <span className={s.op}>×</span>
          <span className={s.frac}>
            <b data-testid="dose-city-uv">{cityUv}</b>
            <small>
              {d.cityUv} {dose.cityName}
            </small>
            <b data-testid="dose-ref-uv">{refUv}</b>
            <small>
              {d.refUv} {refLabel}
            </small>
          </span>
        </span>
        <span className={s.group}>
          <span className={s.op}>≈</span>
          <span className={s.term}>
            <b data-testid="dose-ratio">{ratio}</b>
            <small>{d.rounded}</small>
          </span>
          <span className={s.op}>=</span>
          <span className={`${s.term} ${s.termResult}`}>
            <b data-testid="dose-intensity">{intensity}</b>
            <small>{d.intensity}</small>
          </span>
        </span>
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

type ResultProps = {
  data: FutureResult;
  titleTag?: "h1" | "h2";
  catalogue: Product[];
  /** A product picked on a store page: shown first, and the routine opens with it as the morning step. */
  product?: Product | null;
  cart?: string[] | null;
};

export function Result({ data, titleTag: Title = "h1", catalogue, product = null, cart = null }: ResultProps) {
  const uid = useId();
  const [years, setYears] = useState(() => data.horizons[data.horizons.length - 1]?.years ?? 0);
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

  const idx = Math.max(0, data.horizons.findIndex((x) => x.years === years));
  const h = data.horizons[idx];
  if (!h) return null;
  const labelOf = (i: number, y: number) => landing.visual.horizon[i] ?? `+${y} yrs`;

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
            <span className={`${s.pill} ${data.source === "demo" ? s.pillNeutral : s.pillAccent}`}>
              {data.source === "demo" ? c.eyebrow.demo : c.eyebrow.live}
            </span>
            <span className={s.today}>
              {data.input ? <img src={data.input} alt="" className={s.avatar} /> : null}
              <span className={s.todayLabel}>{c.today}</span>
              <b className={s.todayAge}>{data.inputAge}</b>
            </span>
            {data.uv ? (
              <span className={`${s.pill} ${s.pillNeutral}`}>
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
          <div className={s.segmented} role="group" aria-labelledby={`${uid}-hz`}>
            {data.horizons.map((x, i) => (
              <button
                key={x.years}
                type="button"
                className={s.segment}
                aria-pressed={x.years === h.years}
                onClick={() => setYears(x.years)}
              >
                {labelOf(i, x.years)}
              </button>
            ))}
          </div>
        </div>
      </header>

      {data.notice ? (
        <p className={s.notice} role="status">
          <span className={s.noticeDot} aria-hidden />
          {data.notice}
        </p>
      ) : null}

      <div className={s.grid}>
        <Compare ref={figureRef} h={h} label={labelOf(idx, h.years)} dose={data.dose} citation={data.citation} />
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
      <Routine id={routineId} uv={data.uv} headingRef={routineHead} catalogue={catalogue} prefer={product?.code} cart={cart} />
    ) : null}
    </>
  );
}

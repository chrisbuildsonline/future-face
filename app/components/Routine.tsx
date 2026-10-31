"use client";

import { useId, useRef, useState, type Ref } from "react";
import { result as rc, routine as c } from "@/lib/copy";
import { productLabel, type Product } from "@/lib/products";
import { fitsConcern, routineFor, type Concerns } from "@/lib/routine";
import type { Uv } from "@/lib/uv";
import s from "./Routine.module.css";

type Format = "tube" | "bottle" | "compact" | "mist" | "stick" | "jar";

const FORMATS: Record<Product["kind"], Format> = {
  cream: "tube",
  fluid: "bottle",
  stick: "stick",
  spray: "mist",
  cleanser: "jar",
};

const formatOf = (p: Product): Format => FORMATS[p.kind] ?? "tube";

/** The real product photo on a soft white tile, or the drawn package when the catalogue has no photo. */
export function ProductImage({ product, small = false }: { product: Product; small?: boolean }) {
  if (!product.image) return <ProductArt product={product} small={small} />;
  return <img src={product.image} alt={productLabel(product)} className={small ? s.photoSmall : s.photo} data-testid="product-photo" />;
}

export function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path d="M3 9h11M10 4.5 14.5 9 10 13.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <path d="m2.5 7.4 2.9 2.9 6-6.4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Plus() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <path d="M7 2v10M2 7h10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** A drawn, unbranded package. The shape follows the product format. */
function ProductArt({ product, small = false }: { product: Product; small?: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const format = formatOf(product);
  const body = `url(#${uid}b)`;
  const cap = `url(#${uid}c)`;
  const glow = `url(#${uid}g)`;
  const spf = product.spf ? `SPF ${product.spf}` : null;
  const label = (x: number, y: number, w: number, h: number) => (
    <>
      <rect x={x} y={y} width={w} height={h} rx="7" className={s.artLabel} />
      <circle cx={x + w / 2} cy={y + 13} r="5.5" className={s.artSun} />
      {spf ? (
        <text x={x + w / 2} y={y + h - 9} textAnchor="middle" className={s.artText}>
          {spf}
        </text>
      ) : null}
    </>
  );
  return (
    <svg className={small ? s.artSmall : s.art} viewBox="0 0 160 200" data-format={format} aria-hidden>
      <defs>
        <linearGradient id={`${uid}b`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" className={s.gBodyA} />
          <stop offset="0.58" className={s.gBodyB} />
          <stop offset="1" className={s.gBodyC} />
        </linearGradient>
        <linearGradient id={`${uid}c`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" className={s.gCapA} />
          <stop offset="0.35" className={s.gCapB} />
          <stop offset="1" className={s.gCapC} />
        </linearGradient>
        <linearGradient id={`${uid}g`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" className={s.gGlowA} />
          <stop offset="1" className={s.gGlowB} />
        </linearGradient>
      </defs>
      <ellipse cx="80" cy="186" rx="50" ry="5" className={s.artFloor} />

      {format === "bottle" && (
        <>
          <rect x="62" y="36" width="36" height="14" rx="6" fill={cap} />
          <rect x="94" y="40" width="22" height="6" rx="3" fill={cap} />
          <rect x="76" y="48" width="8" height="16" fill={cap} />
          <rect x="66" y="62" width="28" height="20" rx="4" fill={cap} />
          <rect x="50" y="78" width="60" height="106" rx="20" fill={body} className={s.artLine} />
          {label(60, 108, 40, 50)}
        </>
      )}

      {format === "tube" && (
        <>
          <rect x="46" y="24" width="68" height="12" rx="2" className={s.artShade} />
          <path d="M48 36H112L104 146Q103 152 97 152H63Q57 152 56 146Z" fill={body} className={s.artLine} />
          <rect x="62" y="150" width="36" height="6" className={s.artShade} />
          <rect x="59" y="155" width="42" height="29" rx="8" fill={cap} />
          {label(61, 66, 38, 50)}
        </>
      )}

      {format === "stick" && (
        <>
          <ellipse cx="114" cy="186" rx="26" ry="4" className={s.artFloor} />
          <g transform="rotate(14 118 140)">
            <rect x="98" y="100" width="40" height="78" rx="12" fill={cap} />
          </g>
          <path d="M54 94V72Q54 58 69 58Q84 58 84 72V94Z" fill={glow} />
          <rect x="44" y="90" width="50" height="94" rx="12" fill={body} className={s.artLine} />
          <rect x="44" y="164" width="50" height="6" className={s.artShade} />
          <rect x="54" y="106" width="30" height="46" rx="7" className={s.artLabel} />
          <circle cx="69" cy="120" r="5.5" className={s.artSun} />
          {product.spf ? (
            <text x="69" y="143" textAnchor="middle" className={s.artTextBig}>
              {product.spf}
            </text>
          ) : null}
        </>
      )}

      {format === "compact" && (
        <>
          <circle cx="80" cy="76" r="52" fill={body} className={s.artLine} />
          <circle cx="80" cy="76" r="41" className={s.artMirror} />
          <path d="M56 58Q70 40 96 38" className={s.artSheen} />
          <rect x="70" y="124" width="20" height="8" rx="3" fill={cap} />
          <ellipse cx="80" cy="160" rx="58" ry="25" className={s.artShade} />
          <ellipse cx="80" cy="152" rx="58" ry="25" fill={body} className={s.artLine} />
          <ellipse cx="80" cy="151" rx="45" ry="17" fill={glow} />
          {spf ? (
            <text x="80" y="155" textAnchor="middle" className={s.artText}>
              {spf}
            </text>
          ) : null}
        </>
      )}

      {format === "mist" && (
        <>
          {[
            [46, 50, 3.2],
            [36, 43, 2.6],
            [38, 57, 2.4],
            [26, 50, 2],
            [27, 37, 1.6],
            [24, 62, 1.5],
            [16, 45, 1.2],
          ].map(([cx, cy, r]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} className={s.artMist} />
          ))}
          <rect x="62" y="40" width="36" height="28" rx="8" fill={cap} />
          <circle cx="62" cy="50" r="2.6" className={s.artSun} />
          <rect x="65" y="66" width="30" height="18" rx="4" fill={cap} />
          <rect x="52" y="82" width="56" height="102" rx="18" fill={body} className={s.artLine} />
          {label(62, 112, 36, 50)}
        </>
      )}

      {format === "jar" && (
        <>
          <rect x="32" y="94" width="96" height="32" rx="10" fill={cap} />
          <rect x="38" y="100" width="84" height="3" rx="1.5" className={s.artCapLine} />
          <rect x="36" y="122" width="88" height="62" rx="16" fill={body} className={s.artLine} />
          <rect x="36" y="141" width="88" height="24" className={s.artLabel} />
          <circle cx="80" cy="153" r="6.5" className={s.artSun} />
          <circle cx="83.5" cy="150.5" r="5.5" className={s.artLabel} />
        </>
      )}
    </svg>
  );
}

const countLabel = (n: number) => `${n} ${n === 1 ? c.item : c.items}`;

/** The saved routine list: shared by the desktop rail card and the phone bottom sheet. */
function ListBody({ idPrefix, items, generic }: { idPrefix: string; items: Product[]; generic: boolean }) {
  return (
    <>
      <div className={s.bagHead}>
        <h3 id={`${idPrefix}-title`} className={s.bagTitle}>
          {c.listTitle}
        </h3>
        <span className={`${s.pill} ${items.length ? s.pillAccent : s.pillNeutral}`} data-testid="bag-count">
          {countLabel(items.length)}
        </span>
      </div>
      {items.length ? (
        <ul className={s.bagItems}>
          {items.map((p) => (
            <li key={p.code} className={s.bagItem} data-testid="bag-item">
              <span className={s.bagThumb}>
                <ProductImage product={p} small />
              </span>
              <span className={s.bagItemText}>
                {p.brand ? <span className={s.bagItemBrand}>{p.brand}</span> : null}
                <span className={s.bagItemName}>{p.name}</span>
                {p.size ? <span className={s.bagItemSize}>{p.size}</span> : null}
              </span>
              {p.spf ? <span className={`${s.pill} ${s.pillNeutral}`}>SPF {p.spf}</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className={s.bagEmpty}>{c.listEmpty}</p>
      )}
      <p className={s.fiction}>{generic ? c.fiction : c.listNote}</p>
    </>
  );
}

type RoutineProps = {
  id: string;
  uv: Uv;
  headingRef: Ref<HTMLHeadingElement>;
  catalogue: Product[];
  prefer?: string | null;
  /** The model's readings of the shown horizon: the morning pick follows the weakest (lowest) one (a preferred product still wins). */
  concerns?: Concerns | null;
  /** Codes the embedding store sells: those steps post "future-face:add" to the parent page. */
  cart?: string[] | null;
};

export function Routine({ id, uv, headingRef, catalogue, prefer, concerns, cart }: RoutineProps) {
  const uid = useId();
  const r = routineFor(uv.uvMax, catalogue, prefer, concerns);
  // only say "picked for" when the morning product really is the concern's kind (not a fallback, not a store pick)
  const morning = r.steps.find((x) => x.id === "morning")?.product;
  const focus = r.focus && !r.preferred && morning && fitsConcern(morning, r.focus.concern) ? r.focus.concern : null;
  const [ids, setIds] = useState<string[]>([]);
  const sheet = useRef<HTMLDialogElement>(null);
  const watch = r.band !== "low" && r.band !== "moderate";
  const generic = r.steps.some((x) => x.product.source === "generic");
  const items = ids.map((code) => r.steps.find((x) => x.product.code === code)?.product).filter((p): p is Product => !!p);

  const toggle = (code: string) => setIds((xs) => (xs.includes(code) ? xs.filter((x) => x !== code) : [...xs, code]));
  const addToCart = (code: string) => window.parent.postMessage({ type: "future-face:add", code }, "*");

  return (
    <section id={id} className={s.routine} aria-labelledby={`${uid}-t`}>
      <header className={s.head}>
        <div className={s.headCopy}>
          <div className={s.meta}>
            <span className={`${s.pill} ${s.pillAccent}`}>{c.eyebrow}</span>
            <span className={`${s.pill} ${s.pillNeutral}`}>{uv.city}</span>
            <span className={`${s.pill} ${watch ? s.pillWatch : s.pillGood}`}>{rc.uv.bands[r.band]}</span>
          </div>
          <h2 id={`${uid}-t`} ref={headingRef} tabIndex={-1} className={s.title}>
            {c.titlePrefix} <em>UV {r.uv}</em>
          </h2>
          <p className={s.lead}>
            <b>SPF {r.spf}</b> {c.everyMorning} {r.amount}. <span>{r.reapply}.</span>
          </p>
        </div>
        <dl className={s.facts}>
          <div className={s.fact}>
            <dt>{c.facts.spf}</dt>
            <dd>{r.spf}</dd>
          </div>
          <div className={s.fact}>
            <dt>{c.facts.amount}</dt>
            <dd>{c.facts.amountValue}</dd>
          </div>
          <div className={s.fact}>
            <dt>{r.reapplyHours ? c.facts.reapply : c.facts.noReapply}</dt>
            <dd>{r.reapplyHours ? `${r.reapplyHours} ${c.facts.hours}` : c.facts.noReapplyValue}</dd>
          </div>
        </dl>
      </header>

      <div className={s.layout}>
        <ol className={s.steps}>
          {r.steps.map((step, i) => {
            const p = step.product;
            const on = ids.includes(p.code);
            const sold = cart?.includes(p.code) ?? false;
            const picked = step.id === "morning" && r.preferred?.code === p.code;
            return (
              <li
                key={step.id}
                className={s.step}
                data-testid="routine-step"
                data-step={step.id}
                data-code={p.code}
                data-selected={on || undefined}
                data-picked={picked || undefined}
              >
                <div className={s.stepHead}>
                  <span className={s.stepNum} aria-hidden>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className={s.stepLabel}>{step.label}</span>
                  {p.spf ? <span className={`${s.pill} ${s.pillNeutral} ${s.stepSpf}`}>SPF {p.spf}</span> : null}
                </div>
                <div className={`${s.tile} ${p.image ? s.tilePhoto : ""}`}>
                  <ProductImage product={p} />
                </div>
                {/* the tag and the product details share one row, so a tag never pushes "Why this step" down */}
                <div className={s.about}>
                  {picked && r.fit ? (
                    <span className={`${s.pill} ${r.fit.ok ? s.pillGood : s.pillWatch} ${s.fit}`} data-testid="fit-pill">
                      {r.fit.line}
                    </span>
                  ) : null}
                  {step.id === "morning" && focus ? (
                    <span className={`${s.pill} ${s.pillAccent} ${s.fit}`} data-testid="focus-pill">
                      <span className={s.focusDot} aria-hidden />
                      {`${c.focusPrefix} ${c.focus[focus]}, ${c.focusSuffix}`}
                    </span>
                  ) : null}
                  <div className={s.info}>
                    {p.brand ? <p className={s.brand}>{p.brand}</p> : null}
                    <h3 className={s.name}>{p.name}</h3>
                    <p className={s.size}>{[p.kind, p.size].filter(Boolean).join(" · ")}</p>
                  </div>
                </div>
                <p className={s.why} data-testid="why">
                  <span className={s.whyLabel}>{c.why}</span>
                  {step.why}
                </p>
                <div className={s.buy} data-testid="buy">
                  {p.url ? (
                    <a href={p.url} className={s.obf} target="_blank" rel="noreferrer" aria-label={`${c.obf}: ${productLabel(p)}`}>
                      {c.obfShort}
                      <span aria-hidden> ↗</span>
                    </a>
                  ) : (
                    <span />
                  )}
                  {sold ? (
                    <button type="button" className={`${s.add} ${s.addCart}`} aria-label={`${c.addToCart}: ${productLabel(p)}`} onClick={() => addToCart(p.code)}>
                      <Plus />
                      <span className={s.addText}>{c.addToCart}</span>
                    </button>
                  ) : (
                    <button type="button" className={s.add} aria-pressed={on} aria-label={`${c.add} ${p.name}`} onClick={() => toggle(p.code)}>
                      {on ? <Check /> : <Plus />}
                      <span className={s.addText}>{on ? c.added : c.add}</span>
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <aside className={s.bag} data-testid="bag" aria-labelledby={`${uid}-rail-title`}>
          <ListBody idPrefix={`${uid}-rail`} items={items} generic={generic} />
        </aside>
      </div>

      {generic ? null : (
        <p className={s.attribution}>
          <a href={c.attributionUrl} target="_blank" rel="noreferrer">
            {c.attribution}
          </a>
        </p>
      )}

      <div className={s.bar} data-testid="bag-bar">
        <span className={s.barSummary} aria-live="polite">
          <b>{c.listTitle}</b> · {countLabel(ids.length)}
        </span>
        <button type="button" className={`${s.cta} ${s.ctaCompact}`} aria-haspopup="dialog" onClick={() => sheet.current?.showModal()}>
          <span>{c.viewList}</span>
          <span className={s.ctaIcon}>
            <Arrow />
          </span>
        </button>
      </div>

      <dialog
        ref={sheet}
        className={s.sheet}
        aria-labelledby={`${uid}-sheet-title`}
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        <div className={s.sheetInner}>
          <div className={s.sheetTop}>
            <span className={s.grabber} aria-hidden />
            <button type="button" className={s.close} onClick={() => sheet.current?.close()}>
              {c.close}
            </button>
          </div>
          <ListBody idPrefix={`${uid}-sheet`} items={items} generic={generic} />
        </div>
      </dialog>
    </section>
  );
}

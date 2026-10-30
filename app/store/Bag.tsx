"use client";

import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { store as c } from "@/lib/copy";
import { productLabel, type Product } from "@/lib/products";
import { Arrow, ProductImage } from "../components/Routine";
import s from "./store.module.css";

// The preview bag: barcodes in localStorage (in memory if storage is blocked), shared by /store and the
// product pages. Mirrors the routine's saved list (app/components/Routine.tsx): no prices, nothing sold.

const KEY = "sunday-pharmacy-bag";
const CHANGED = "sunday-bag";
const OPEN = "sunday-bag-open";
let memory = "[]";

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(CHANGED, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(CHANGED, cb);
  };
}

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}

function parse(raw: string): string[] {
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function save(codes: string[]) {
  memory = JSON.stringify(codes);
  try {
    localStorage.setItem(KEY, memory);
  } catch {}
  window.dispatchEvent(new Event(CHANGED));
}

const useCodes = () => parse(useSyncExternalStore(subscribe, read, () => "[]"));

function Plus() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path d="M9 3.5v11M3.5 9h11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <path
        d="M4.2 6.5h11.6l-.9 10.1a1.5 1.5 0 0 1-1.5 1.4H6.6a1.5 1.5 0 0 1-1.5-1.4zM7 8.5V5.8a3 3 0 0 1 6 0v2.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The primary action on a product page: adds one to the bag and opens it. */
export function AddToBag({ code }: { code: string }) {
  return (
    <button
      type="button"
      className={s.cart}
      aria-describedby="preview-note"
      onClick={() => {
        save([...parse(read()), code]);
        window.dispatchEvent(new Event(OPEN));
      }}
    >
      <span>{c.addToCart}</span>
      <span className={s.cartIcon}>
        <Plus />
      </span>
    </button>
  );
}

const itemsLabel = (n: number) => `${n} ${n === 1 ? "item" : "items"}`;

/** The header pill with the count, and the drawer (a bottom sheet on a phone) listing the items. */
export function Bag({ catalogue }: { catalogue: Product[] }) {
  const uid = useId();
  const codes = useCodes();
  const drawer = useRef<HTMLDialogElement>(null);
  const lines = [...new Set(codes)]
    .map((code) => ({ p: catalogue.find((p) => p.code === code), qty: codes.filter((x) => x === code).length }))
    .filter((l): l is { p: Product; qty: number } => !!l.p);
  const n = lines.reduce((sum, l) => sum + l.qty, 0);
  const open = () => {
    if (!drawer.current?.open) drawer.current?.showModal();
  };

  useEffect(() => {
    window.addEventListener(OPEN, open);
    return () => window.removeEventListener(OPEN, open);
  });

  return (
    <>
      <button type="button" className={s.bagButton} aria-haspopup="dialog" aria-label={`${c.bag}: ${itemsLabel(n)}`} onClick={open}>
        <BagIcon />
        <span className={s.bagLabel}>{c.bag}</span>
        <span className={`${s.count} ${n ? s.countOn : ""}`} data-testid="bag-count">
          {n}
        </span>
      </button>

      <dialog
        ref={drawer}
        className={s.drawer}
        aria-labelledby={`${uid}-t`}
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        <div className={s.drawerInner}>
          <div className={s.drawerHead}>
            <h2 id={`${uid}-t`} className={s.drawerTitle}>
              {c.bagTitle}
            </h2>
            <span className={`${s.pill} ${n ? s.pillAccent : s.pillNeutral}`}>{itemsLabel(n)}</span>
            <button type="button" className={s.close} onClick={() => drawer.current?.close()}>
              {c.close}
            </button>
          </div>

          {lines.length ? (
            <ul className={s.lines}>
              {lines.map(({ p, qty }) => (
                <li key={p.code} className={s.line} data-testid="bag-item">
                  <span className={s.lineThumb}>
                    <ProductImage product={p} small />
                  </span>
                  <span className={s.lineText}>
                    {p.brand ? <span className={s.lineBrand}>{p.brand}</span> : null}
                    <a href={`/store/${p.code}`} className={s.lineName}>
                      {p.name}
                    </a>
                    <span className={s.lineMeta}>{[p.spf ? `SPF ${p.spf}` : null, p.size, qty > 1 ? `Qty ${qty}` : null].filter(Boolean).join(" · ")}</span>
                  </span>
                  <button
                    type="button"
                    className={s.remove}
                    aria-label={`${c.remove} ${productLabel(p)}`}
                    onClick={() => save(parse(read()).filter((x) => x !== p.code))}
                  >
                    {c.remove}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.empty}>{c.bagEmpty}</p>
          )}

          <div className={s.drawerFoot}>
            <p className={s.previewLine}>{c.bagPreview}</p>
            <a href="/store" className={s.cta}>
              <span>{c.keepBrowsing}</span>
              <span className={s.cartIcon}>
                <Arrow />
              </span>
            </a>
            <a href={c.wooUrl} className={s.woo} target="_blank" rel="noreferrer">
              {c.woo}
              <span aria-hidden> ↗</span>
            </a>
          </div>
        </div>
      </dialog>
    </>
  );
}

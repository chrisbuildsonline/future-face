"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { result as c } from "@/lib/copy";
import s from "./CompareSlider.module.css";

/** The one-time 60% -> 40% -> 50% sweep that teaches the gesture (DESIGN.md, Motion). */
function useSweep(setPos: (n: number) => void) {
  const stop = useRef<() => void>(() => {});
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const keys = [50, 60, 40, 50];
    let raf = 0;
    let start = 0;
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
    const tick = (t: number) => {
      start ||= t;
      const p = Math.min((t - start) / 1200, 1);
      const seg = Math.min(Math.floor(p * 3), 2);
      const f = ease(p * 3 - seg);
      setPos(keys[seg] + (keys[seg + 1] - keys[seg]) * f);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    const delay = window.setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, 500);
    const cancel = () => {
      window.clearTimeout(delay);
      cancelAnimationFrame(raf);
    };
    stop.current = cancel;
    return cancel;
  }, [setPos]);
  return stop;
}

type Props = {
  /** The "as you live now" render (under) and the "with daily SPF" render (clipped on top). */
  now: string;
  spf: string;
  /** Appended to each arm's alt text, e.g. the horizon. */
  label: string;
  /** data-testid prefix: `${testId}-now`, `${testId}-spf`. */
  testId?: string;
  /** Sizing of the frame, from the parent's own stylesheet. */
  className?: string;
};

/** Before/after slider (DESIGN.md "Before/after slider"): one frame, a divider, a round handle, corner tags. */
export function CompareSlider({ now, spf, label, testId = "face", className = "" }: Props) {
  const [pos, setPos] = useState(50);
  const stopSweep = useSweep(setPos);
  // How far in from its own side each corner tag reaches, as % of the frame: a tag fades once the divider
  // gets that close, so it never sits over a sliver of its face (or across the divider).
  const frame = useRef<HTMLDivElement>(null);
  const [reach, setReach] = useState({ left: 0, right: 0 });
  useEffect(() => {
    const el = frame.current!;
    const [l, r] = Array.from(el.querySelectorAll<HTMLElement>(`.${s.tag}`));
    const ro = new ResizeObserver(() => {
      const f = el.getBoundingClientRect();
      const pct = (px: number) => ((px + 8) / f.width) * 100; // 8px of air past the tag
      setReach({ left: pct(l.getBoundingClientRect().right - f.left), right: pct(f.right - r.getBoundingClientRect().left) });
    });
    [el, l, r].forEach((x) => ro.observe(x));
    return () => ro.disconnect();
  }, []);
  return (
    <div
      ref={frame}
      className={`${s.frame} ${className}`}
      style={{ "--pos": `${pos}%` } as CSSProperties}
      onPointerDown={() => stopSweep.current()}
    >
      <img key={`now-${now}`} data-testid={`${testId}-now`} className={s.face} src={now} alt={`${c.slider.left}, ${label}`} />
      <img
        key={`spf-${spf}`}
        data-testid={`${testId}-spf`}
        className={s.face}
        src={spf}
        alt={`${c.slider.right}, ${label}`}
        style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
      />
      <span className={s.divider} aria-hidden />
      <input
        type="range"
        className={s.range}
        min={0}
        max={100}
        step={1}
        value={Math.round(pos)}
        aria-label={c.slider.label}
        aria-valuetext={`${c.slider.left} ${Math.round(pos)}%, ${c.slider.right} ${100 - Math.round(pos)}%`}
        onChange={(e) => {
          stopSweep.current();
          setPos(Number(e.target.value));
        }}
      />
      <span className={s.handle} aria-hidden>
        <svg width="22" height="14" viewBox="0 0 22 14">
          <path d="M6 1 1 7l5 6M16 1l5 6-5 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className={`${s.tag} ${s.tagLeft}`} aria-hidden data-faded={pos < reach.left ? "" : undefined}>
        {c.slider.left}
      </span>
      <span className={`${s.tag} ${s.tagRight}`} aria-hidden data-faded={100 - pos < reach.right ? "" : undefined}>
        {c.slider.right}
      </span>
    </div>
  );
}

import { landing } from "@/lib/copy";
import styles from "./TwoFutureMark.module.css";

// An honest illustration of the product, not a render: a UV arc over an abstract
// face split by the before/after slider. Left half carries spots and grain
// ("as you live now"), right half stays clean ("with daily SPF").

const W = 500;
const H = 600;
const FACE = { cx: 250, cy: 372, rx: 150, ry: 150 };
const ARC = { cx: 250, cy: 372, r: 206 };
const UV_SHARE = 0.72; // where the sun sits on the 0..11+ arc

function polar(share: number, r = ARC.r) {
  const a = Math.PI * (1 - share);
  return { x: ARC.cx + r * Math.cos(a), y: ARC.cy - r * Math.sin(a) };
}

function arcPath(from: number, to: number, r = ARC.r) {
  const a = polar(from, r);
  const b = polar(to, r);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

// Deterministic spot field on the left half of the face.
function spots() {
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const out: { x: number; y: number; r: number; o: number }[] = [];
  while (out.length < 50) {
    const x = FACE.cx - FACE.rx + rand() * FACE.rx;
    const y = FACE.cy - FACE.ry + rand() * FACE.ry * 2;
    const inside = ((x - FACE.cx) / FACE.rx) ** 2 + ((y - FACE.cy) / FACE.ry) ** 2 < 0.9;
    if (!inside || x > FACE.cx - 8) continue;
    out.push({ x, y, r: 1.1 + rand() * rand() * 3.4, o: 0.2 + rand() * 0.38 });
  }
  return out;
}

const SPOTS = spots();
const TICKS = Array.from({ length: 12 }, (_, i) => i / 11);
const SUN = polar(UV_SHARE);

export function TwoFutureMark() {
  const v = landing.visual;
  return (
    <div className={styles.wrap} role="img" aria-label={v.label}>
      <div className={styles.glow} aria-hidden />
      <div className={styles.card}>
        <div className={styles.stage}>
          <svg className={styles.svg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden>
            <defs>
              <linearGradient id="tfm-arc" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#f4d3bf" />
                <stop offset="1" stopColor="#bf4f28" />
              </linearGradient>
              <radialGradient id="tfm-skin" cx="0.64" cy="0.28" r="0.85">
                <stop offset="0" stopColor="#f7e2d3" />
                <stop offset="0.5" stopColor="#e8bc9f" />
                <stop offset="1" stopColor="#c98a68" />
              </radialGradient>
              <radialGradient id="tfm-sun" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0" stopColor="#bf4f28" stopOpacity="0.35" />
                <stop offset="1" stopColor="#bf4f28" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="tfm-sheen" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
                <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
              <clipPath id="tfm-face">
                <ellipse cx={FACE.cx} cy={FACE.cy} rx={FACE.rx} ry={FACE.ry} />
              </clipPath>
              <filter id="tfm-grain" x="0" y="0" width="100%" height="100%">
                <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="3" />
                <feColorMatrix
                  type="matrix"
                  values="0 0 0 0 0.45  0 0 0 0 0.25  0 0 0 0 0.15  0 0 0 0.55 -0.12"
                />
                <feComposite in2="SourceGraphic" operator="in" />
              </filter>
              <filter id="tfm-shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#281c10" floodOpacity="0.22" />
              </filter>
            </defs>

            {/* UV arc */}
            <path d={arcPath(0, 1)} fill="none" stroke="#ece6df" strokeWidth="14" strokeLinecap="round" />
            <path
              d={arcPath(0, UV_SHARE)}
              fill="none"
              stroke="url(#tfm-arc)"
              strokeWidth="14"
              strokeLinecap="round"
            />
            {TICKS.map((t) => {
              const a = polar(t, ARC.r + 22);
              const b = polar(t, ARC.r + 30);
              return (
                <line key={t} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#c9c1b8" strokeWidth="2" strokeLinecap="round" />
              );
            })}
            <circle cx={SUN.x} cy={SUN.y} r="44" fill="url(#tfm-sun)" />
            <circle cx={SUN.x} cy={SUN.y} r="15" fill="#fff" filter="url(#tfm-shadow)" />
            <circle cx={SUN.x} cy={SUN.y} r="7" fill="#bf4f28" />

            {/* abstract face */}
            <ellipse cx={FACE.cx} cy={FACE.cy} rx={FACE.rx} ry={FACE.ry} fill="url(#tfm-skin)" />
            <g clipPath="url(#tfm-face)">
              {/* left: as you live now */}
              <rect x={FACE.cx - FACE.rx} y={FACE.cy - FACE.ry} width={FACE.rx} height={FACE.ry * 2} fill="#a35a36" opacity="0.2" />
              <rect
                x={FACE.cx - FACE.rx}
                y={FACE.cy - FACE.ry}
                width={FACE.rx}
                height={FACE.ry * 2}
                fill="#fff"
                filter="url(#tfm-grain)"
              />
              {SPOTS.map((s, i) => (
                <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#8f4f31" opacity={s.o} />
              ))}
              {/* right: with daily SPF */}
              <ellipse cx={FACE.cx + 58} cy={FACE.cy - 62} rx="66" ry="80" fill="url(#tfm-sheen)" />
            </g>

            {/* slider */}
            <line x1={FACE.cx} y1={FACE.cy - FACE.ry - 30} x2={FACE.cx} y2={H} stroke="#fff" strokeWidth="3" />
            <g filter="url(#tfm-shadow)">
              <circle cx={FACE.cx} cy={FACE.cy} r="27" fill="#fff" />
            </g>
            <path
              d={`M ${FACE.cx - 6} ${FACE.cy - 8} l -8 8 l 8 8 M ${FACE.cx + 6} ${FACE.cy - 8} l 8 8 l -8 8`}
              fill="none"
              stroke="#17140f"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <div className={styles.horizon} aria-hidden>
            <span>{v.horizon[0]}</span>
            <span className={styles.horizonOn}>{v.horizon[1]}</span>
          </div>
          <span className={`${styles.tag} ${styles.tagLeft}`} aria-hidden>
            {v.leftTag}
          </span>
          <span className={`${styles.tag} ${styles.tagRight}`} aria-hidden>
            {v.rightTag}
          </span>
        </div>
      </div>

      <div className={`${styles.chip} ${styles.chipUv}`} aria-hidden>
        <span className={styles.chipTitle}>{v.uvTitle}</span>
        <span className={styles.uvBar}>
          <span className={styles.uvDot} style={{ left: `${UV_SHARE * 100}%` }} />
        </span>
        <span className={styles.uvScale}>
          <span>{v.uvScale[0]}</span>
          <span>{v.uvScale[1]}</span>
        </span>
        <span className={styles.chipNote}>{v.uvNote}</span>
      </div>

      <div className={`${styles.chip} ${styles.chipCite}`} aria-hidden>
        <span className={styles.citeDot} />
        <span>{v.citationChip}</span>
      </div>
    </div>
  );
}

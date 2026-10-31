import type { Metadata } from "next";
import Link from "next/link";
import { brand, landing, notFound as c } from "@/lib/copy";
import n from "./not-found.module.css";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `${c.eyebrow} · ${brand.name}`,
};

function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path d="M3 9h11M10 4.5 14.5 9 10 13.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function NotFound() {
  return (
    <>
      <header className={styles.nav}>
        <Link href="/" className={styles.wordmark} aria-label={brand.name}>
          <span className={styles.mark} aria-hidden />
          {brand.name}
        </Link>
      </header>

      <main className={n.main}>
        <section className={n.card} aria-labelledby="nf-title">
          <span className={n.num} aria-hidden>
            404
          </span>
          <span className={`${styles.pill} ${styles.pillNeutral}`}>{c.eyebrow}</span>
          <h1 id="nf-title" className={n.title}>
            {c.title.slice(0, c.title.length - c.titleAccent.length)}
            <em>{c.titleAccent}</em>
          </h1>
          <p className={n.lead}>{c.lead}</p>
          <div className={n.actions}>
            <Link href="/result" className={`${styles.cta} ${n.cta}`}>
              <span>{c.demo}</span>
              <span className={styles.ctaIcon}>
                <Arrow />
              </span>
            </Link>
            <Link href="/store" className={styles.storeLink}>
              {c.store}
            </Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <span className={styles.footerBrand}>{brand.name}</span>
        <span>{landing.footer.note}</span>
        <span>{landing.footer.license}</span>
      </footer>
    </>
  );
}

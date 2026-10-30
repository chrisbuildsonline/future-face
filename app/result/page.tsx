import type { Metadata } from "next";
import Link from "next/link";
import { brand, landing, result } from "@/lib/copy";
import { demoResult } from "@/lib/pipeline";
import { Result } from "../components/Result";
import styles from "../page.module.css";

export const metadata: Metadata = {
  title: `${result.eyebrow.demo} · ${brand.name}`,
  description: result.lead,
};

export default function ResultPage() {
  return (
    <>
      <header className={styles.nav}>
        <Link href="/" className={styles.wordmark} aria-label={brand.name}>
          <span className={styles.mark} aria-hidden />
          {brand.name}
        </Link>
        <nav className={styles.navRight}>
          <Link href="/" className={`${styles.navLink} ${styles.navBack}`}>
            <span aria-hidden>←</span> {result.nav.back}
          </Link>
          <Link href="/#upload" className={styles.navCta}>
            {result.nav.own}
          </Link>
        </nav>
      </header>

      <main className={styles.page}>
        <Result data={demoResult()} />
      </main>

      <footer className={styles.footer}>
        <span className={styles.footerBrand}>{brand.name}</span>
        <span>{landing.footer.note}</span>
        <span>{landing.footer.fiction}</span>
        <span>{landing.footer.license}</span>
      </footer>
    </>
  );
}

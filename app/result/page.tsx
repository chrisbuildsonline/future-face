import type { Metadata } from "next";
import Link from "next/link";
import { findProduct, loadCatalogue } from "@/lib/catalogue";
import { brand, embed as ec, landing, result } from "@/lib/copy";
import { demoResult } from "@/lib/pipeline";
import { isCode } from "@/lib/products";
import { EmbedClose } from "../components/EmbedClose";
import e from "../components/EmbedClose.module.css";
import { Result } from "../components/Result";
import { Upload } from "../components/Upload";
import styles from "../page.module.css";

export const metadata: Metadata = {
  title: `${result.eyebrow.demo} · ${brand.name}`,
  description: result.lead,
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ResultPage({ searchParams }: Props) {
  const q = await searchParams;
  const code = one(q.product);
  const product = isCode(code) ? findProduct(code) : null;
  const embed = one(q.embed) === "1";
  const cart = embed ? one(q.cart).split(",").filter(isCode) : null;
  const catalogue = loadCatalogue();

  // Store widget modal: the shopper's own selfie first (one job), the demo face as a labelled fallback below.
  if (embed)
    return (
      <main className={e.embed}>
        <p className={e.brandRow}>
          <span aria-hidden />
          {brand.name}
        </p>
        <EmbedClose />
        <section className={e.try} aria-labelledby="embed-title">
          <header className={e.tryHead}>
            <span className={`${styles.pill} ${styles.pillAccent}`}>{ec.eyebrow}</span>
            <h1 id="embed-title" className={e.title}>
              {ec.title.slice(0, ec.title.length - ec.titleAccent.length)}
              <em>{ec.titleAccent}</em>
            </h1>
            <p className={e.lead}>{ec.lead}</p>
          </header>
          <Upload catalogue={catalogue} product={product} cart={cart} />
        </section>
        <section className={e.fallback} aria-labelledby="embed-fallback">
          <div className={e.fallbackHead}>
            <h2 id="embed-fallback" className={e.fallbackTitle}>
              {ec.fallback}
            </h2>
            <p className={e.fallbackNote}>{ec.fallbackNote}</p>
          </div>
          <Result data={demoResult()} titleTag="h2" catalogue={catalogue} product={product} cart={cart} />
        </section>
      </main>
    );

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
          <Link href="/#upload" className={`${styles.navCta} ${styles.navGhost}`}>
            {result.nav.own}
          </Link>
        </nav>
      </header>

      <main className={styles.page}>
        <Result data={demoResult()} catalogue={catalogue} product={product} />
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

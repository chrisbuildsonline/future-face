import Link from "next/link";
import { brand, landing, upload } from "@/lib/copy";
import { TwoFutureMark } from "./components/TwoFutureMark";
import { Upload } from "./components/Upload";
import styles from "./page.module.css";

function Title() {
  const { title, titleAccent } = landing.hero;
  const lead = title.slice(0, title.length - titleAccent.length);
  return (
    <h1 className={styles.title}>
      {lead}
      <em>{titleAccent}</em>
    </h1>
  );
}

function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        d="M3 9h11M10 4.5 14.5 9 10 13.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Home() {
  const { nav, hero, how, footer } = landing;
  return (
    <>
      <header className={styles.nav}>
        <a href="#top" className={styles.wordmark} aria-label={brand.name}>
          <span className={styles.mark} aria-hidden />
          {brand.name}
        </a>
        <nav className={styles.navRight}>
          <a href="#how" className={styles.navLink}>
            {nav.how}
          </a>
          <span className={`${styles.pill} ${styles.pillAccent} ${styles.navBadge}`}>{nav.badge}</span>
        </nav>
      </header>

      <main id="top">
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={`${styles.pill} ${styles.pillNeutral}`}>{hero.eyebrow}</span>
            <Title />
            <p className={styles.lead}>{hero.lead}</p>
          </div>
          <div className={styles.heroVisual}>
            <TwoFutureMark />
          </div>
          <div className={styles.heroAction}>
            <Link href="/result" className={styles.cta}>
              <span>{hero.cta}</span>
              <span className={styles.ctaIcon}>
                <Arrow />
              </span>
            </Link>
            <p className={styles.ctaNote}>
              {hero.ctaNote}{" "}
              <a href="#upload" className={styles.link}>
                {hero.ctaAlt}
              </a>
            </p>
          </div>
        </section>

        <section id="upload" className={styles.how} aria-labelledby="upload-title">
          <div className={styles.sectionHead}>
            <span className={`${styles.pill} ${styles.pillAccent}`}>{upload.eyebrow}</span>
            <h2 id="upload-title" className={styles.h2}>
              {upload.title.slice(0, upload.title.length - upload.titleAccent.length)}
              <em>{upload.titleAccent}</em>
            </h2>
            <p className={styles.lead}>{upload.lead}</p>
          </div>
          <Upload />
        </section>

        <section id="how" className={styles.how} aria-labelledby="how-title">
          <div className={styles.sectionHead}>
            <span className={`${styles.pill} ${styles.pillNeutral}`}>{how.eyebrow}</span>
            <h2 id="how-title" className={styles.h2}>
              {how.title}
            </h2>
            <p className={styles.lead}>{how.lead}</p>
          </div>

          <ol className={styles.steps}>
            {how.steps.map((s) => (
              <li key={s.n} className={styles.step}>
                <div className={styles.stepTop}>
                  <span className={styles.stepNum}>{s.n}</span>
                  <span className={`${styles.pill} ${styles.pillAccent}`}>{s.api}</span>
                </div>
                <h3 className={styles.h3}>{s.title}</h3>
                <p className={styles.body}>{s.body}</p>
              </li>
            ))}
          </ol>

          <article className={styles.evidence}>
            <div className={styles.evidenceHead}>
              <span className={`${styles.pill} ${styles.pillNeutral}`}>{how.citation.eyebrow}</span>
              <h3 className={styles.evidenceTitle}>{how.citation.title}</h3>
            </div>
            <dl className={styles.stats}>
              {how.citation.stats.map((st) => (
                <div key={st.label} className={styles.stat}>
                  <dt className={styles.statLabel}>{st.label}</dt>
                  <dd className={styles.statValue}>{st.value}</dd>
                </div>
              ))}
            </dl>
            <p className={styles.cite}>
              {how.citation.text}{" "}
              <a href={how.citation.url} className={styles.link} target="_blank" rel="noreferrer">
                {how.citation.linkLabel}
              </a>
            </p>
          </article>
        </section>
      </main>

      <footer className={styles.footer}>
        <span className={styles.footerBrand}>{brand.name}</span>
        <span>{footer.note}</span>
        <span>{footer.fiction}</span>
        <span>{footer.license}</span>
      </footer>
    </>
  );
}

import type { Metadata } from "next";
import { loadCatalogue } from "@/lib/catalogue";
import { store as c } from "@/lib/copy";
import { shelves } from "@/lib/shelves";
import { Crumbs, ProductCard, ShopFooter, ShopHeader } from "./Shop";
import s from "./store.module.css";

// Sunday Pharmacy's catalogue: every product of the active catalogue, on shelves by kind.

export const metadata: Metadata = { title: "Sunday Pharmacy (store preview)" };

export default function Catalogue() {
  const catalogue = loadCatalogue();
  const groups = shelves(catalogue);

  return (
    <div className={s.shop}>
      <ShopHeader catalogue={catalogue} active="all" />

      <main className={s.main}>
        <Crumbs items={[{ label: c.home, href: "/" }, { label: "Sunday Pharmacy" }]} />

        <div className={s.hero}>
          <h1 className={s.heroTitle}>
            {c.title} <em>{c.titleAccent}</em>
          </h1>
          <div className={s.heroSide}>
            <p className={s.heroLead}>{c.lead}</p>
            <ul className={s.stats}>
              {groups.map((g) => (
                <li key={g.id}>
                  <a href={`#${g.id}`} className={s.stat}>
                    <span className={s.statNum}>{String(g.products.length).padStart(2, "0")}</span>
                    <span className={s.statLabel}>{g.title}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {groups.map((g) => (
          <section key={g.id} id={g.id} className={s.shelf} aria-labelledby={`${g.id}-title`}>
            <div className={s.shelfHead}>
              <h2 id={`${g.id}-title`} className={s.shelfTitle}>
                {g.title}
              </h2>
              <p className={s.shelfNote}>{g.note}</p>
            </div>
            <ul className={s.cards}>
              {g.products.map((p) => (
                <li key={p.code}>
                  <ProductCard p={p} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>

      <ShopFooter />
    </div>
  );
}

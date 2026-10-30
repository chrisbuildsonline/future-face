import { store as c } from "@/lib/copy";
import type { Product } from "@/lib/products";
import { shelves } from "@/lib/shelves";
import { Arrow, ProductImage } from "../components/Routine";
import { Bag } from "./Bag";
import s from "./store.module.css";

// The Sunday Pharmacy shell shared by /store and /store/[barcode]. Every nav item, crumb and card is a
// real link; the nav only lists shelves the active catalogue fills.

export const KIND: Record<Product["kind"], string> = {
  cream: "Sun cream",
  fluid: "Sun fluid",
  stick: "Sun stick",
  spray: "Sun spray",
  cleanser: "Cleanser",
};

export function ShopHeader({ catalogue, active }: { catalogue: Product[]; active: string }) {
  const lite = catalogue.map((p) => ({ ...p, ingredients: "" })); // the bag needs no ingredient lists
  return (
    <header className={s.header}>
      <a href="/store" className={s.logo}>
        Sunday <em>Pharmacy</em>
      </a>
      <nav className={s.navLinks} aria-label="Shop">
        <a href="/store" aria-current={active === "all" ? "page" : undefined}>
          {c.all}
        </a>
        {shelves(catalogue).map((sh) => (
          <a key={sh.id} href={`/store#${sh.id}`} aria-current={active === sh.id ? "true" : undefined}>
            {sh.title}
          </a>
        ))}
      </nav>
      <span className={`${s.pill} ${s.pillAccent} ${s.badge}`}>{c.badge}</span>
      <Bag catalogue={lite} />
    </header>
  );
}

export function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className={s.crumbs}>
      <ol>
        {items.map((it) =>
          it.href ? (
            <li key={it.label}>
              <a href={it.href}>{it.label}</a>
            </li>
          ) : (
            <li key={it.label}>
              <span aria-current="page">{it.label}</span>
            </li>
          ),
        )}
      </ol>
    </nav>
  );
}

export function ShopFooter() {
  return (
    <footer className={s.footer}>
      <p>
        {c.footer} <a href="/">{c.home}</a>
      </p>
      <a href={c.wooUrl} className={s.woo} target="_blank" rel="noreferrer">
        {c.woo}
        <span aria-hidden> ↗</span>
      </a>
    </footer>
  );
}

export function ProductCard({ p }: { p: Product }) {
  return (
    <a href={`/store/${p.code}`} className={s.card}>
      <span className={s.cardPhoto}>
        <ProductImage product={p} />
        {p.spf ? <span className={`${s.pill} ${s.cardSpf}`}>SPF {p.spf}</span> : null}
      </span>
      <span className={s.cardBody}>
        {p.brand ? <span className={s.cardBrand}>{p.brand}</span> : null}
        <span className={s.cardName}>{p.name}</span>
        <span className={s.cardFoot}>
          <span className={s.cardMeta}>{[KIND[p.kind], p.size].filter(Boolean).join(" · ")}</span>
          <span className={s.cardGo} aria-hidden>
            <Arrow />
          </span>
        </span>
      </span>
    </a>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findProduct, loadCatalogue } from "@/lib/catalogue";
import { isCode } from "@/lib/products";
import { ProductImage } from "../../components/Routine";
import s from "./store.module.css";

// A preview of a made-up shop, "Sunday Pharmacy", with the Future Face widget embedded the way a store would.

type Props = { params: Promise<{ barcode: string }> };

export function generateStaticParams() {
  return loadCatalogue()
    .filter((p) => isCode(p.code))
    .map((p) => ({ barcode: p.code }));
}

const lookup = (code: string) => (isCode(code) ? findProduct(code) : null);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = lookup((await params).barcode);
  return { title: p ? `${p.name} · Sunday Pharmacy (store preview)` : "Sunday Pharmacy" };
}

const KIND: Record<string, string> = { cream: "Sun cream", fluid: "Sun fluid", stick: "Sun stick", spray: "Sun spray", cleanser: "Cleanser" };

export default async function StorePage({ params }: Props) {
  const p = lookup((await params).barcode);
  if (!p) notFound();
  const snippet = `<script src="http://localhost:3000/widget.js" defer></script>\n<div data-future-face data-product="${p.code}"${p.spf ? ` data-spf="${p.spf}"` : ""}></div>`;

  return (
    <div className={s.shop}>
      <header className={s.nav}>
        <a href={`/store/${p.code}`} className={s.logo}>
          Sunday <em>Pharmacy</em>
        </a>
        <nav className={s.navLinks} aria-label="Shop">
          <span>Sun care</span>
          <span>Face</span>
          <span>Body</span>
        </nav>
        <span className={`${s.pill} ${s.pillAccent}`}>Store preview</span>
      </header>

      <main className={s.main}>
        <p className={s.crumbs}>
          Sun care <span aria-hidden>/</span> {KIND[p.kind] ?? "Sun care"}
        </p>
        <div className={s.grid}>
          <div className={s.gallery}>
            <div className={s.photo}>
              <ProductImage product={p} />
            </div>
          </div>

          <section className={s.buy} aria-labelledby="product-name">
            {p.brand ? <p className={s.brand}>{p.brand}</p> : null}
            <h1 id="product-name" className={s.name}>
              {p.name}
            </h1>
            <div className={s.facts}>
              {p.spf ? <span className={`${s.pill} ${s.pillNeutral}`}>SPF {p.spf}</span> : null}
              {p.size ? <span className={`${s.pill} ${s.pillNeutral}`}>{p.size}</span> : null}
              <span className={`${s.pill} ${s.pillNeutral}`}>{KIND[p.kind]}</span>
            </div>
            <p className={s.price}>Price set by the store</p>

            <button type="button" className={s.cart} disabled aria-describedby="preview-note">
              Add to cart
            </button>
            <p id="preview-note" className={s.note}>
              Preview only: this shop is made up, so nothing can be bought here.
            </p>

            <div className={s.widget}>
              <script src="/widget.js" defer></script>
              <div data-future-face data-product={p.code} data-spf={p.spf ?? undefined}></div>
            </div>

            {p.ingredients ? (
              <details className={s.details}>
                <summary>Ingredients</summary>
                <p>{p.ingredients}</p>
              </details>
            ) : null}
            {p.url ? (
              <p className={s.source}>
                Product data and photo:{" "}
                <a href={p.url} target="_blank" rel="noreferrer">
                  Open Beauty Facts
                </a>{" "}
                (ODbL, CC BY-SA)
              </p>
            ) : null}
          </section>
        </div>

        <aside className={s.aside} aria-labelledby="embed-title">
          <div>
            <span className={`${s.pill} ${s.pillNeutral}`}>For store owners</span>
            <h2 id="embed-title" className={s.asideTitle}>
              Add this to your store in <em>two lines</em>
            </h2>
            <p className={s.asideLead}>
              Paste it on any product page. The pill opens Future Face with that product as the morning step.
            </p>
          </div>
          <pre className={s.code}>
            <code>{snippet}</code>
          </pre>
        </aside>
      </main>
    </div>
  );
}

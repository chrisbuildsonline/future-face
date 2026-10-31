import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findProduct, loadCatalogue } from "@/lib/catalogue";
import { store as c } from "@/lib/copy";
import { shelfOf } from "@/lib/shelves";
import { ProductImage } from "../../components/Routine";
import { AddToBag } from "../Bag";
import { Crumbs, KIND, ShopFooter, ShopHeader } from "../Shop";
import { Snippet } from "../Snippet";
import s from "../store.module.css";

// A preview of a made-up shop, "Sunday Pharmacy", with the Future Face widget embedded the way a store would.

type Props = { params: Promise<{ barcode: string }> };

// Every product of the active catalogue has a page (the fictional set's codes too); anything else is a 404.
export function generateStaticParams() {
  return loadCatalogue().map((p) => ({ barcode: p.code }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = findProduct((await params).barcode);
  return { title: p ? `${p.name} · Sunday Pharmacy (store preview)` : "Sunday Pharmacy" };
}

export default async function StorePage({ params }: Props) {
  const p = findProduct((await params).barcode);
  if (!p) notFound();
  const shelf = shelfOf(p.kind);

  return (
    <div className={s.shop}>
      <ShopHeader catalogue={loadCatalogue()} active={shelf.id} />

      <main className={s.main}>
        <Crumbs items={[{ label: "Shop", href: "/store" }, { label: shelf.title, href: `/store#${shelf.id}` }, { label: p.name }]} />
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
            <p className={s.price}>{c.price}</p>

            <AddToBag code={p.code} />
            <p id="preview-note" className={s.note}>
              {c.note}
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
            <Snippet code={p.code} spf={p.spf} />
          </pre>
        </aside>
      </main>

      <ShopFooter />
    </div>
  );
}

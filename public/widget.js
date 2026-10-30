/* Future Face store widget. Plain ES2020, no deps. Embed on a product page:
   <script src="https://<future-face host>/widget.js" defer></script>
   <div data-future-face data-product="<barcode>" data-spf="50" data-cart='{"<barcode>":"<add-to-cart url>"}'></div> */
(() => {
  const me =
    document.currentScript ||
    Array.from(document.scripts).find((s) => /\/widget\.js(\?|#|$)/.test(s.src));
  if (!me || !me.src) return;
  const ORIGIN = new URL(me.src, location.href).origin;
  const FONT = "Manrope, 'Manrope Variable', system-ui, -apple-system, 'Segoe UI', sans-serif";

  const CSS = `
:host{all:initial;display:inline-block;font-family:${FONT}}
.pill{display:inline-flex;align-items:center;gap:12px;min-height:56px;padding:8px 22px 8px 10px;border:0;border-radius:999px;
background:#17140F;color:#fff;font:600 15px/1.25 ${FONT};letter-spacing:-.005em;cursor:pointer;text-align:left;
box-shadow:0 2px 4px rgba(40,28,16,.05),0 18px 40px -18px rgba(40,28,16,.4);transition:background .16s cubic-bezier(.2,.7,.2,1),transform .16s cubic-bezier(.2,.7,.2,1)}
.pill:hover{background:#2A2620;transform:translateY(-1px)}
.pill:focus-visible{outline:3px solid #BF4F28;outline-offset:3px}
.sun{flex:none;width:40px;height:40px;border-radius:50%;background:#fff;display:grid;place-items:center}
.sun i{width:18px;height:18px;border-radius:50%;background:linear-gradient(90deg,#BF4F28 50%,#F4D3BF 50%);box-shadow:0 0 0 4px #F6E2D8}
`;

  const MODAL = `
.ff-back{position:fixed;inset:0;z-index:2147483646;background:rgba(23,20,15,.48);display:grid;place-items:center;padding:4vh 24px;
opacity:0;transition:opacity .32s cubic-bezier(.2,.7,.2,1)}
.ff-back.ff-on{opacity:1}
.ff-frame{width:min(1180px,100%);height:90vh;border:0;border-radius:20px;background:#F1EEEA;
box-shadow:0 2px 4px rgba(40,28,16,.05),0 30px 60px -24px rgba(40,28,16,.28);transform:translateY(16px);transition:transform .32s cubic-bezier(.2,.7,.2,1)}
.ff-on .ff-frame{transform:none}
@media (max-width:720px){.ff-back{padding:0}.ff-frame{width:100%;height:100%;border-radius:0}}
@media (prefers-reduced-motion:reduce){.ff-back,.ff-frame{transition:none}}
`;

  let open = null; // { back, frame, host, cart, overflow }

  function close() {
    if (!open) return;
    const { back, host, overflow } = open;
    open = null;
    back.remove();
    document.body.style.overflow = overflow;
    document.removeEventListener("keydown", onKey, true);
    const pill = host.shadowRoot && host.shadowRoot.querySelector("button");
    if (pill) pill.focus();
  }

  function onKey(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  function parseCart(raw) {
    try {
      const v = JSON.parse(raw || "{}");
      return v && typeof v === "object" && !Array.isArray(v) ? v : {};
    } catch {
      return {};
    }
  }

  function show(host) {
    if (open) return;
    if (!document.getElementById("ff-modal-css")) {
      const st = document.createElement("style");
      st.id = "ff-modal-css";
      st.textContent = MODAL;
      document.head.appendChild(st);
    }
    const code = host.dataset.product || "";
    const cart = parseCart(host.dataset.cart);
    const q = new URLSearchParams({ embed: "1" });
    if (code) q.set("product", code);
    const keys = Object.keys(cart).filter((k) => /^\d{8,14}$/.test(k));
    if (keys.length) q.set("cart", keys.join(","));

    const back = document.createElement("div");
    back.className = "ff-back";
    back.setAttribute("data-future-face-modal", "");
    const frame = document.createElement("iframe");
    frame.className = "ff-frame";
    frame.title = "Future Face: your face in 20 years";
    frame.src = `${ORIGIN}/result?${q}`;
    frame.setAttribute("role", "dialog");
    frame.setAttribute("aria-modal", "true");
    back.appendChild(frame);
    back.addEventListener("click", (e) => {
      if (e.target === back) close();
    });

    open = { back, frame, host, cart, overflow: document.body.style.overflow };
    document.body.style.overflow = "hidden";
    document.body.appendChild(back);
    document.addEventListener("keydown", onKey, true);
    requestAnimationFrame(() => back.classList.add("ff-on"));
    frame.focus();
    // Esc inside the iframe is handled by the embed page, which posts future-face:close.
    frame.addEventListener("load", () => frame.focus());
  }

  window.addEventListener("message", (e) => {
    if (e.origin !== ORIGIN || !open || e.source !== open.frame.contentWindow) return;
    const d = e.data || {};
    if (d.type === "future-face:close") close();
    else if (d.type === "future-face:add" && typeof d.code === "string") {
      const url = open.cart[d.code];
      if (typeof url === "string" && /^https?:/i.test(new URL(url, location.href).protocol)) location.assign(url);
    }
  });

  function mount(host) {
    if (host.shadowRoot) return;
    const root = host.attachShadow({ mode: "open" });
    const spf = (host.dataset.spf || "").trim();
    const label = /^\d{1,3}$/.test(spf) ? `See your face in 20 years with SPF ${spf}` : "See your face in 20 years";
    root.innerHTML = `<style>${CSS}</style><button type="button" class="pill" aria-haspopup="dialog"><span class="sun" aria-hidden="true"><i></i></span><span></span></button>`;
    const btn = root.querySelector("button");
    btn.lastElementChild.textContent = label;
    btn.addEventListener("click", () => show(host));
  }

  const run = () => document.querySelectorAll("[data-future-face]").forEach(mount);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();

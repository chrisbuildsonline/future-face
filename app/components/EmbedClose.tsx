"use client";

import { useEffect } from "react";
import s from "./EmbedClose.module.css";

const close = () => window.parent.postMessage({ type: "future-face:close" }, "*");

/** Close for the store widget's modal: the parent page (public/widget.js) listens for this message. Esc closes too. */
export function EmbedClose() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // An open bottom sheet or citation popover takes Esc first.
      if (e.key === "Escape" && !document.querySelector("dialog[open], :popover-open")) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <button type="button" className={s.close} aria-label="Close Future Face" data-testid="embed-close" onClick={close}>
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </button>
  );
}

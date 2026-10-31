"use client";

import { useSyncExternalStore } from "react";

// The embed snippet for store owners, pointing at the origin this page is served from (localhost, any
// port, or the hosted copy behind its https proxy). The page stays static: the server renders a relative
// src, then the browser swaps in window.location.origin with no hydration mismatch.

const noop = () => () => {};

export function Snippet({ code, spf }: { code: string; spf: number | null }) {
  const origin = useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => "",
  );
  return <code>{`<script src="${origin}/widget.js" defer></script>\n<div data-future-face data-product="${code}"${spf ? ` data-spf="${spf}"` : ""}></div>`}</code>;
}

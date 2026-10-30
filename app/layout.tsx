import type { Metadata, Viewport } from "next";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource-variable/manrope/index.css";
import "./globals.css";
import { brand, landing } from "@/lib/copy";

export const metadata: Metadata = {
  title: `${brand.name} — ${brand.tagline}`,
  description: landing.hero.lead,
};

export const viewport: Viewport = {
  themeColor: "#F1EEEA",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

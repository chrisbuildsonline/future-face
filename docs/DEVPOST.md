# Devpost draft: Future Face

Paste into the Devpost submission form. Upload [demo.mp4](demo.mp4) to YouTube or Vimeo first, then put that public link on the form. Repo: https://github.com/chrisbuildsonline/future-face (MIT). Hosted demo: https://future-face.5-78-152-178.sslip.io

## Elevator pitch (short)

Two faces of you in 20 or 30 years, side by side: one that kept living as now, and one that wore sunscreen every day in your city. Built from your selfie with three YouCam APIs, and it lives on the store product page.

## Full description

**The problem.** SPF sits on a shelf. The payoff is years away, so shoppers under-buy. Retailers need a product-page moment that makes daily sunscreen feel concrete, not clinical.

**What it does.** Future Face takes one selfie and runs three YouCam APIs in order:

1. **AI Aging Generator** projects you to +20 or +30. Both arms share that same aging frame.
2. **AI Skin Simulation** applies the "with daily SPF" pass at a cited dose: 0.24 × (your city's UV / Nambour UV) × a measured skin-tone factor (ITA). The 0.24 comes from Hughes et al., Annals of Internal Medicine 2013 (Nambour trial: 24% less skin aging with daily sunscreen).
3. **AI Skin Analysis** reads wrinkles, texture and spots on both renders, so the gap shows up as numbers (higher = better-looking skin).

Then it sizes a three-step SPF routine from real Open Beauty Facts products (or a fictional catalogue for brand-safe demos) to today's UV from Open-Meteo.

**Where it plugs in.** A store embeds it with two lines of HTML (`public/widget.js` + a barcode div). There is a Sunday Pharmacy preview, a WooCommerce plugin under `store/`, and a hosted copy that redeploys with the repo.

**Try it with no key.** Open the hosted demo or run `bun install && bun run dev`. Click **See your two futures**. Uploads without a YouCam key (or when units are out) fall back to the recorded demo with a clear notice.

## Built with

- YouCam API: Skin Analysis, AI Aging Generator, AI Skin Simulation
- Next.js 16, React 19, Bun, Playwright, Sharp, MediaPipe face landmarker
- Open-Meteo UV (CC BY 4.0), Open Beauty Facts product photos
- Docker image for a fresh-clone smoke test

## Testing instructions for judges

1. Open https://future-face.5-78-152-178.sslip.io (zero-key demo face).
2. Drag the divider. Switch +20 / +30. Open **Source** on a measured row.
3. Tap **Try another city** on demo face 2 (London vs Sydney moves the dose).
4. Click **Build my SPF routine**, then **See it in a store** from the landing.
5. Optional live upload if units remain; otherwise the paused demo path is intentional.
6. Repo README covers Docker, WooCommerce (`bun run store`), and env vars.

## Demo video

Public demo: https://youtu.be/apt0nKwRU-g

Local file: `docs/demo.mp4` (1080p, ~1:44, American voice clone, generic catalogue).

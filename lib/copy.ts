// All on-screen copy for the landing page. Non-medical wording only:
// lib/copy.test.ts fails the build of the suite if a banned stem slips in.
// Client components import this file, so it must not import lib/evidence (which reaches node:fs via lib/uv).
// The dose numbers on the result come from FutureResult.dose, not from here.

import type { ErrorKind } from "./youcam";

export const brand = {
  name: "Future Face",
  tagline: "Two faces of you in 30 years",
} as const;

export const disclaimer = "Every render is an illustrative projection, not a prognosis.";

export const landing = {
  nav: {
    how: "How it works",
    badge: "YouCam Skin AI",
  },
  hero: {
    eyebrow: "Two futures, one selfie",
    // no-break space: "30 years" never splits across lines on a phone
    title: "Meet yourself in 30 years. Twice.",
    titleAccent: "Twice.",
    lead: "One face kept living as now. The other wore sunscreen every day in your city. See them side by side, read by the same model, with the routine that closes the gap.",
    cta: "See your two futures",
    ctaNote: "Opens a recorded demo face. No upload, no account.",
    ctaAlt: "Or use your own selfie",
    store: "See it in a store",
  },
  // The hero: the recorded demo face at +30, both futures on one slider.
  visual: {
    caption: "The demo face in 30 years, as you live now and with daily SPF. An illustrative projection, not a prognosis.",
    alt: "demo face in 30 years",
    horizon: ["+20 yrs", "+30 yrs"],
    today: "Demo face, age today",
    later: "in 30 years",
    citationChip: "Effect sizes from a 4.5-year trial",
  },
  how: {
    eyebrow: "How it works",
    title: "Three models. One honest comparison.",
    lead: "Your selfie goes through three YouCam APIs in sequence. Every number on the result screen is the model's reading of a render, and every intensity links back to its source.",
    steps: [
      {
        n: "01",
        api: "AI Aging Generator",
        title: "Twenty and thirty years on",
        body: "The selfie is projected forward as you live now, with the UV index of your city in the frame.",
      },
      {
        n: "02",
        api: "AI Skin Simulation",
        title: "The same frame, with daily SPF",
        body: "Both faces start from that one frame. The SPF face goes through Skin Simulation at 0.24, from the 24% in the trial below, scaled by your city's UV today against the trial town's.",
      },
      {
        n: "03",
        api: "AI Skin Analysis",
        title: "Both faces, read by one model",
        body: "Both renders are read by the same model, so the gap shows up as numbers, then as a routine sized to your sun.",
      },
    ],
    citation: {
      eyebrow: "The evidence",
      title: "The trial behind every intensity.",
      stats: [
        { value: "903", label: "adults in the trial" },
        { value: "4.5", label: "years of follow-up" },
        { value: "24%", label: "less skin aging than discretionary use" },
      ],
      text: "Hughes MCB, Williams GM, Baker P, Green AC. Sunscreen and prevention of skin aging: a randomized trial. Ann Intern Med. 2013;158(11):781-790.",
      linkLabel: "Read the trial",
      url: "https://doi.org/10.7326/0003-4819-158-11-201306040-00002",
    },
  },
  footer: {
    note: disclaimer,
    fiction: "Built for the YouCam API Skin AI hackathon.",
    license: "MIT licensed",
  },
} as const;

// The two-face result screen (demo at /result, live runs on the landing).
export const result = {
  nav: { back: "Back", own: "Try your own selfie" },
  // paused: YouCam is out of units, so a submit got the demo result (status pill beside the Demo pill)
  eyebrow: { demo: "Demo face", live: "Your selfie", paused: "Live renders paused" },
  titlePrefix: "You in",
  titleYears: "years.",
  titleAccent: "Twice.",
  lead: "Left, the face as you live now. Right, the face with daily SPF. Drag the divider to compare.",
  horizonLabel: "Years ahead",
  // the city chips on a demo result: one tap re-reads the dose at that city's UV today (GET /api/future?city=)
  cities: {
    label: "Try another city",
    names: ["London", "Dubai", "Sydney", "Lima"],
    hint: "Tap a city: the SPF dose follows its UV today.",
    // "London · UV 1.0 → dose 0.12" when the step moved, "Lima · UV 9.9 → same dose step (0.24)" when it did not
    dose: "dose",
    same: "same dose step",
    // "London: no live UV right now, so the recorded Nambour reading stays."
    noLive: "no live UV right now, so the recorded",
    noLiveTail: "reading stays.",
    error: "That city did not load. The result is unchanged.",
  },
  // the demo face switch: the group is named by eyebrow.demo, these name each round avatar link
  faces: { a: "Demo face 1", b: "Demo face 2" } as Record<string, string>,
  today: "Age read today",
  slider: {
    label: "Divider between the two futures",
    left: "As you live now",
    right: "With daily SPF",
  },
  disclaimer: "Illustrative projection, not a prognosis.",
  frame: {
    age: "Frame age",
    target: "Target age",
    both: "Both faces",
    nearest: "The Aging Generator returns preset ages, so both faces use the nearest frame.",
    method: "The SPF face is that same frame through Skin Simulation, at the dose below. The trial measured skin aging, not a render, so read this as an illustration.",
  },
  dose: {
    eyebrow: "The SPF dose",
    api: "AI Skin Simulation",
    cite: "Hughes 2013",
    trial: "24% less aging",
    cityUv: "UV today in",
    refUv: "UV in",
    trialSite: "the trial site",
    // one phrase for the visible label and the screen-reader sentence, so both say the same rounding
    rounded: "rounded to nearest 0.5",
    intensity: "intensity",
    uvRatio: "UV ratio",
    tone: "Skin tone",
    toneShort: "skin tone",
    toneMeasured: "measured on your face",
    notMeasured: "not measured",
    bands: {
      very_light: "very light",
      light: "light",
      intermediate: "intermediate",
      tan: "tan",
      brown: "brown",
      dark: "dark",
    },
    citeTone: "Chardon 1991",
    citeMelanin: "Kaidbey 1979",
    sources: "Sources",
    sentence: "Skin Simulation at",
    sentenceTone: "skin tone factor",
    sentenceSkin: "skin",
  },
  measured: {
    eyebrow: "Read by AI Skin Analysis",
    title: "The model reading",
    higher: "Higher = better-looking skin",
    foot: "Each number is the model's own reading of that render (Skin Analysis raw_score, 0 to 100), not a reading of you.",
    labels: { wrinkle: "Wrinkles", texture: "Texture", spots: "Spots" } as Record<string, string>,
    order: ["wrinkle", "texture", "spots"],
    intensity: "SPF intensity",
    source: "Source",
  },
  citation: {
    eyebrow: "Why this intensity",
    stat: "24%",
    statLabel: "less skin aging with daily sunscreen",
    how: "Skin Simulation runs on the same aging frame as the other face, at this amount on spots, wrinkles and texture (the model's 0 to 1 scale): 0.24 at the trial site's UV, scaled by your city's UV today.",
    doiLabel: "doi",
    link: "Read the trial",
  },
  closeup: {
    eyebrow: "Up close",
    title: "Under the eye, both ways.",
    lead: "Same crop, same zoom on both faces, so the difference is the only difference.",
  },
  uv: {
    eyebrow: "UV today",
    peak: "Peak UV index forecast",
    recorded: "Recorded reading",
    live: "Live reading",
    scaleLow: "0",
    scaleHigh: "11+",
    bands: {
      low: "Low UV",
      moderate: "Moderate UV",
      high: "High UV",
      very_high: "Very high UV",
      extreme: "Extreme UV",
    },
    attribution: "Weather data by Open-Meteo.com",
    attributionUrl: "https://open-meteo.com/",
  },
} as const;

// The SPF routine + saved list that opens from the result (products from lib/catalogue.ts via routineFor).
export const routine = {
  cta: "Build my SPF routine",
  ctaNote: "Three real products, sized to the UV where you live.",
  ctaNoteGeneric: "Three fictional products, sized to the UV where you live.",
  eyebrow: "Your SPF routine",
  titlePrefix: "Your routine for",
  everyMorning: "every morning.",
  stepLabel: "Step",
  why: "Why this step",
  add: "Save",
  added: "Saved",
  addToCart: "Add to cart",
  listTitle: "Your routine",
  listEmpty: "Nothing saved yet. Save a step to keep your routine.",
  listNote: "Saved on this page only. Find each product in your usual shop.",
  obf: "View on Open Beauty Facts",
  // the visible label (one line in a narrow card); the link's accessible name is `${obf}: <product>`
  obfShort: "Open Beauty Facts",
  with: "With",
  item: "item",
  items: "items",
  viewList: "View routine",
  close: "Close",
  attribution: "Product data and photos: Open Beauty Facts (ODbL, CC BY-SA)",
  attributionUrl: "https://world.openbeautyfacts.org/terms-of-use",
  fiction: "Fictional products. No brands, no logos.",
  // the morning pick's focus: "Picked for lines, your weakest reading" (lowest raw_score; higher = better-looking skin)
  focusPrefix: "Picked for",
  focusSuffix: "your weakest reading",
  focus: { spots: "spots", wrinkle: "lines", texture: "texture" },
  facts: {
    spf: "SPF, every morning",
    amountValue: "¼ tsp",
    amount: "for face and neck",
    hours: "h",
    reapply: "between top-ups outdoors",
    noReapplyValue: "—",
    noReapply: "no top-up on a city day",
  },
} as const;

// The upload step on the landing page.
export const upload = {
  eyebrow: "Your own face",
  title: "Bring a selfie. And your sun.",
  titleAccent: "And your sun.",
  lead: "A clear, front-facing photo and the city you live in. It runs through the same three YouCam models as the demo.",
  file: "Choose a selfie",
  fileHint: "JPG or PNG, facing the camera, up to 10 MB",
  fileChange: "Change photo",
  // The in-browser face crop on the drop tile (app/components/autoCrop.ts).
  cropFinding: "Finding your face",
  cropDone: "We cropped to your face",
  cropUndo: "Undo",
  cropFull: "Using your full photo",
  cropAgain: "Crop again",
  // MediaPipe ran and found no face at all (a face that is there but small gets cropped instead).
  noFace: "We couldn't find a face in that photo",
  noFaceHint: "Try a clear, front-facing selfie in good light, with your whole face in the frame.",
  city: "Your city",
  cityPlaceholder: "Lisbon",
  cities: ["Lisbon", "Madrid", "London", "Stockholm", "Cape Town", "Sydney", "Brisbane", "Singapore", "Mexico City", "Los Angeles"],
  submit: "Show my two futures",
  // under the submit while it is disabled: what is still missing
  needBoth: "Add a selfie and your city",
  needSelfie: "Add a selfie",
  needCity: "Add your city",
  loadingTitle: "Rendering your two futures",
  loading: "Three YouCam models run one after another. A live run usually takes one to two minutes, so keep this tab open.",
  elapsed: "elapsed",
  resultLabel: "Your result",
  // under a submit error: the recorded demo result always works
  demoLink: "See the demo face",
} as const;

// The store widget's modal (/result?embed=1): the shopper's own selfie first, the demo face below.
export const embed = {
  eyebrow: "On your own face",
  title: "Try this SPF on your face.",
  titleAccent: "your face.",
  lead: "A selfie and your city. See yourself in 30 years, as you live now and with this SPF every morning.",
  fallback: "Or see it on our demo face",
  fallbackNote: "A recorded run on a face that does not exist. Nothing to upload.",
} as const;

// app/not-found.tsx: any URL that is not a page.
export const notFound = {
  eyebrow: "Page not found",
  title: "This page has no future.",
  titleAccent: "no future.",
  lead: "The link may be old or mistyped. The demo face and the store preview are one click away.",
  demo: "See the demo result",
  store: "Visit the store preview",
} as const;

export const cityErrors = {
  city_not_found: "We couldn't find that city. Try the nearest big city, like \"Lisbon\".",
} as const;

// What the person sees when a photo or a request doesn't go through.
export const errors: Record<ErrorKind, string> = {
  no_face: "We couldn't find a face in that photo. Try a clear selfie where your face is easy to see.",
  multiple_faces: "We spotted more than one person. Please use a photo with just your face in it.",
  face_too_small: "Your face is a little small in that photo. Move closer or crop it so your face fills most of the photo's width.",
  bad_pose: "Your face is turned, tilted or partly out of frame. Look straight at the camera with your whole face centered.",
  bad_image_size: "That photo is too small or too large. Please use one at least 480 pixels on its shortest side.",
  bad_format: "We couldn't open that photo. Please try a JPG or PNG.",
  file_too_large: "That photo is over 10 MB. Please pick a smaller one.",
  low_quality: "We couldn't get a clear look at your face. Try a well-lit photo, facing the camera.",
  // shown as the notice on the paused result (POST answers 200 with the demo result, paused: true)
  insufficient_units: "Live renders are paused while our YouCam credits refill, so this is the demo face with your city's UV.",
  rate_limited: "Lots of people are trying this right now. Please try again in a minute.",
  auth: "Something's off on our side, so live photos aren't working right now. The demo face still works.",
  server_busy: "The imaging service hit a snag. Please try again.",
  timeout: "That took longer than it should have. Please try again.",
  no_key: "Live photos are turned off in this version of the app. The demo face still works.",
  unknown: "Something went wrong. Please try again, or use the demo face.",
};

// The Sunday Pharmacy store preview (app/store): a made-up shop that hosts the widget. No prices anywhere.
export const store = {
  badge: "Store preview",
  all: "Shop all",
  title: "Sun care for every",
  titleAccent: "hour.",
  lead: "Real products from Open Beauty Facts, shelved in routine order. Open any of them: the Future Face pill sits under Add to cart.",
  addToCart: "Add to cart",
  price: "Price set by the store",
  note: "Preview only: this shop is made up, so nothing can be bought here.",
  bag: "Bag",
  bagTitle: "Your bag",
  bagEmpty: "Nothing here yet. Add something from a product page.",
  bagPreview: "Preview only, nothing is sold here.",
  keepBrowsing: "Keep browsing",
  remove: "Remove",
  close: "Close",
  woo: "This shop also runs as a real WooCommerce store",
  wooUrl: "https://github.com/chrisbuildsonline/future-face#run-it-in-a-store-woocommerce-two-commands",
  footer: "Sunday Pharmacy is a made-up shop that hosts the Future Face widget.",
  home: "Future Face",
} as const;

// All on-screen copy for the landing page. Non-medical wording only:
// lib/copy.test.ts fails the build of the suite if a banned stem slips in.

import { SPF_AGING_REDUCTION } from "./evidence";
import type { ErrorKind } from "./youcam";

const fewer = `${Math.round(SPF_AGING_REDUCTION * 100)}%`;

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
    lead: "One face kept living as now. The other wore sunscreen every day in your city. See them side by side, measured, with the routine that closes the gap.",
    cta: "See your two futures",
    ctaNote: "Opens a recorded demo face. No upload, no account.",
    ctaAlt: "Or use your own selfie",
    store: "See it in a store",
  },
  visual: {
    label: "Illustration of the two-future slider",
    leftTag: "As you live now",
    rightTag: "With daily SPF",
    horizon: ["+20 yrs", "+30 yrs"],
    uvTitle: "UV index",
    uvScale: ["Low", "Extreme"],
    uvNote: "Your city's sun sets the scene",
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
        title: "An earlier frame, with daily SPF",
        body: `The SPF face is the aging frame ${fewer} fewer years ahead, after the trial below. Skin Simulation adds a light finishing pass.`,
      },
      {
        n: "03",
        api: "AI Skin Analysis",
        title: "Both faces, measured",
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
  eyebrow: { demo: "Demo face", live: "Your selfie" },
  titlePrefix: "You in",
  titleYears: "years.",
  titleAccent: "Twice.",
  lead: "Left, the face as you live now. Right, the face with daily SPF. Drag the divider to compare.",
  horizonLabel: "Years ahead",
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
    nearest: "The Aging Generator returns preset ages, so each face uses the nearest frame.",
    method: `The SPF face is the aging frame ${fewer} fewer years ahead, because the trial found ${fewer} less skin aging with daily sunscreen. The trial measured skin texture, not years, so read this as an illustration.`,
  },
  measured: {
    eyebrow: "Read by AI Skin Analysis",
    title: "The measured line",
    higher: "Higher = better-looking skin",
    foot: "Each number is the model's own reading of that render (Skin Analysis raw_score, 0 to 100), not a reading of you.",
    labels: { wrinkle: "Wrinkles", texture: "Texture", spots: "Spots" } as Record<string, string>,
    order: ["wrinkle", "texture", "spots"],
    sameFrame: "At this horizon both faces come from the same aging frame, so there is no gap to measure.",
    intensity: "SPF intensity",
    source: "Source",
  },
  citation: {
    eyebrow: "Why this intensity",
    stat: "24%",
    statLabel: "less skin aging with daily sunscreen",
    how: `The SPF face is the aging frame ${fewer} fewer years ahead. Skin Simulation then gives it a finishing pass at this amount on spots, wrinkles and texture, on the model's 0 to 1 scale.`,
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
  with: "With",
  item: "item",
  items: "items",
  viewList: "View routine",
  close: "Close",
  attribution: "Product data and photos: Open Beauty Facts (ODbL, CC BY-SA)",
  attributionUrl: "https://world.openbeautyfacts.org/terms-of-use",
  fiction: "Fictional products. No brands, no logos.",
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
  city: "Your city",
  cityPlaceholder: "Lisbon",
  cities: ["Lisbon", "Madrid", "London", "Stockholm", "Cape Town", "Sydney", "Brisbane", "Singapore", "Mexico City", "Los Angeles"],
  submit: "Show my two futures",
  loadingTitle: "Rendering your two futures",
  loading: "Three YouCam models run one after another. A live run usually takes one to two minutes, so keep this tab open.",
  elapsed: "elapsed",
  resultLabel: "Your result",
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
  insufficient_units: "We've run out of renders on our side for now. The demo face is ready to try in the meantime.",
  rate_limited: "Lots of people are trying this right now. Please try again in a minute.",
  auth: "Something's off on our side, so live photos aren't working right now. The demo face still works.",
  server_busy: "The imaging service hit a snag. Please try again.",
  timeout: "That took longer than it should have. Please try again.",
  no_key: "Live photos are turned off in this version of the app. The demo face still works.",
  unknown: "Something went wrong. Please try again, or use the demo face.",
};

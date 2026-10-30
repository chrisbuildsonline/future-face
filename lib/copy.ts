// All on-screen copy for the landing page. Non-medical wording only:
// lib/copy.test.ts fails the build of the suite if a banned stem slips in.

export const brand = {
  name: "Future Face",
  tagline: "Two faces of you at 45",
} as const;

export const disclaimer = "Every render is an illustrative projection, not a prognosis.";

export const landing = {
  nav: {
    how: "How it works",
    badge: "YouCam Skin AI",
  },
  hero: {
    eyebrow: "Two futures, one selfie",
    title: "Meet yourself at 45. Twice.",
    titleAccent: "Twice.",
    lead: "One face kept living as now. The other wore sunscreen every day in your city. See them side by side, measured, with the routine that closes the gap.",
    cta: "See your two futures",
    ctaNote: "No account needed. A demo face is ready if you'd rather not upload.",
  },
  visual: {
    label: "Illustration of the two-future slider",
    leftTag: "As you live now",
    rightTag: "With daily SPF",
    horizon: ["+10 yrs", "+20 yrs"],
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
        title: "Ten and twenty years on",
        body: "The selfie is projected forward as you live now, with the UV index of your city in the frame.",
      },
      {
        n: "02",
        api: "AI Skin Simulation",
        title: "The same frame, with daily SPF",
        body: "Spots, wrinkles and texture are dialled to the effect sizes reported for daily sunscreen users.",
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
    fiction: "Product names are fictional. Built for the YouCam API Skin AI hackathon.",
    license: "MIT licensed",
  },
} as const;

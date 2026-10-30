// Skin-simulation intensities for the "daily SPF" arm, with the study they come from.

export const SPF_SETTINGS = { spots: 0.24, wrinkle: 0.24, texture: 0.24 };

export const CITATION = {
  text: "Hughes MCB, Williams GM, Baker P, Green AC. Sunscreen and prevention of skin aging: a randomized trial. Ann Intern Med. 2013;158(11):781-790.",
  doi: "10.7326/0003-4819-158-11-201306040-00002",
  finding:
    "Daily sunscreen users showed no detectable increase in skin aging after 4.5 years and 24% less aging than discretionary users.",
};

/** Share of aging avoided with daily sunscreen (Hughes 2013: 24% less aging). The SPF arm shows the face at years * (1 - this). */
export const SPF_AGING_REDUCTION = 0.24;

const basis = "24% less skin aging with daily sunscreen vs discretionary use (Hughes 2013)";

export const INTENSITIES = [
  { key: "spots", value: SPF_SETTINGS.spots, analysisKey: "age_spot", citation: CITATION, basis },
  { key: "wrinkle", value: SPF_SETTINGS.wrinkle, analysisKey: "wrinkle", citation: CITATION, basis },
  { key: "texture", value: SPF_SETTINGS.texture, analysisKey: "texture", citation: CITATION, basis },
] as const;

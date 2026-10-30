# Future Face demo script

A 2 to 2.5 minute walkthrough for a live presenter or the demo video. It needs no YouCam key: everything below runs on the recorded live run of the demo face. Bold text is the exact label on screen. "Say" is the voice-over.

## Before you start

- Run `bun install`, then `bun run dev`, and open http://localhost:3000 in a desktop-width window.
- No `.env` is needed. The demo face is a public-domain StyleGAN2 image; the person does not exist ([fixtures/LICENSE.txt](../fixtures/LICENSE.txt)).
- The numbers below are the recorded ones from [fixtures/demo/result.json](../fixtures/demo/result.json). The UV card shows a recorded Nambour reading of 7.8.

## Script

**1. Landing (0:00 to 0:15)**

- Show: the headline **Meet yourself at 45. Twice.** and the pill **YouCam Skin AI**.
- Say: "Future Face shows you two faces of yourself, years from now. One kept living as now. The other wore sunscreen every day. Same face, same frame, measured by the same model."

**2. How it works (0:15 to 0:30)**

- Click: **How it works** in the top bar. Point at the three cards: **AI Aging Generator**, **AI Skin Simulation**, **AI Skin Analysis**.
- Say: "One selfie, three YouCam APIs in a row. The AI Aging Generator projects the face ten and twenty years on. AI Skin Simulation takes that same frame and applies daily sunscreen. AI Skin Analysis reads both renders, so the gap becomes numbers."
- Then scroll back up.

**3. Open the result (0:30 to 0:45)**

- Click: **See your two futures**.
- Show: the pills **Demo face**, **Age read today 38** and **Nambour · UV 7.8**, and the title **You at 58. Twice.**
- Say: "This is a recorded live run on a face that does not exist. The Aging Generator read her as 38. For twenty years on it returns preset ages, so we pick the nearest frame, and the caption says which one: res_age 58 for target 58."

**4. The slider (0:45 to 1:00)**

- Do: drag the divider across the face, between **As you live now** and **With daily SPF**.
- Say: "Left is the Aging Generator frame as she lives now. Right is the same frame through AI Skin Simulation, with spots, wrinkles and texture dialled to 0.24. The caption is on screen the whole time: illustrative projection, not a prognosis."

**5. Where 0.24 comes from (1:00 to 1:15)**

- Click: **Source** on the **Wrinkles** row. The card **Why this intensity · 0.24** opens.
- Say: "Every intensity has a source. Hughes and colleagues, Annals of Internal Medicine 2013, ran a 4.5-year trial where daily sunscreen users showed 24% less skin aging than discretionary users. We put that 24% on the model's 0 to 1 scale as 0.24. The doi is right here."
- Click anywhere outside the card to close it.

**6. The measured line (1:15 to 1:35)**

- Show: the card **Read by AI Skin Analysis**, **The measured line**, **Higher = better-looking skin**.
- Say: "AI Skin Analysis reads both renders. Wrinkles 71.2 to 79.1, texture 91.4 to 97.5, spots 96.4 to 98.8. Each number is the model's reading of a render, not a reading of you."

**7. Change the horizon (1:35 to 1:45)**

- Click: **+10 yrs**, then **+20 yrs**.
- Say: "Ten years on the gap is smaller, wrinkles plus 6.4. At twenty it is plus 7.9. Both faces and the numbers swap together."

**8. UV where you live (1:45 to 1:55)**

- Show: the **UV today** card, **7.8**, **High UV**, **Nambour, Australia**, and **Weather data by Open-Meteo.com · CC BY 4.0**.
- Say: "The sun is local. The UV index comes from Open-Meteo for your city. This recorded reading is from Nambour, Queensland, where the trial ran."

**9. Build the routine (1:55 to 2:10)**

- Click: **Build my SPF routine**. The view moves to **Your routine for UV 7.8**.
- Say: "High UV, so SPF 50 every morning. Two finger lengths, about a quarter teaspoon, for face and neck, and a top-up every 2 hours outdoors. Three steps: **Morning**, **Midday top-up**, **Evening**."

**10. Bag and checkout (2:10 to 2:25)**

- Click: **Add** on **Noon Fluid SPF 50**, then **Add** on **Glide Stick SPF 50**. Both buttons turn to **Added**; **Your bag** shows **2 items** and **Subtotal** €54.
- Click: **Checkout**.
- Show: the note **This is a demo store, so no order was placed and nothing was charged. The products are fictional.**
- Say: "Two faces, measured, then a routine and a bag sized to the sun where you live. Future Face, built on the YouCam AI Aging Generator, AI Skin Simulation and AI Skin Analysis."

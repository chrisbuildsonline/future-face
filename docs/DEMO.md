# Future Face demo script

A 2 to 2.5 minute walkthrough for a live presenter or the demo video. It needs no YouCam key: everything below runs on the recorded live run of the demo face. Bold text is the exact label on screen. "Say" is the voice-over.

## Before you start

- Run `bun install`, then `bun run dev`, and open http://localhost:3000 in a desktop-width window. Or skip the install and open the hosted copy, https://future-face.5-78-152-178.sslip.io.
- No `.env` is needed. The demo face is a public-domain StyleGAN image from Wikimedia Commons (File:Man_2.jpg, {{PD-algorithm}}); the person does not exist ([fixtures/LICENSE.txt](../fixtures/LICENSE.txt)).
- The numbers below are the recorded ones from [fixtures/demo/result.json](../fixtures/demo/result.json). The UV card shows a recorded Nambour reading of 7.8.
- The product is the first SPF 50 cream in [fixtures/products.json](../fixtures/products.json), a real product from Open Beauty Facts. Below it is called "the product"; read its brand and name off the screen. For a video with no brand on screen, start the server with the generic catalogue (`FF_CATALOGUE=generic`).

## Script

**1. Landing (0:00 to 0:10)**

- Show: the headline **Meet yourself in 30 years. Twice.** and the pill **YouCam Skin AI**.
- Click: **See it in a store**.
- Say: "Future Face shows you two faces of yourself, years from now. One kept living as now, the other wore sunscreen every day. And it lives where people buy sunscreen: on the product page."

**2. The store product page (0:10 to 0:25)**

- Show: **Sunday Pharmacy** with the pill **Store preview**, the product photo, its name, and **Price set by the store**.
- Point at: the pill **See your face in 30 years with SPF 50** under the buy area, and the aside **Add this to your store in two lines**.
- Say: "Sunday Pharmacy is a made-up shop. The product is real, with data and photo from Open Beauty Facts. A store adds Future Face with two lines of HTML: a script and a div with the barcode."

**3. Open the result (0:25 to 0:40)**

- Click: **See your face in 30 years with SPF 50**. A window opens over the store page, on **Try this SPF on your face.**: a shopper can drop a selfie, type a city and press **Show my two futures** right there.
- Scroll to **Or see it on our demo face**.
- Show: the pills **Demo face**, **Age read today 34** and **Nambour · UV 7.8**, the title **You in 30 years. Twice.**, and the line **With** the product, next to the pill **SPF 50 covers a UV 7.8 day**.
- Say: "A shopper can try it on their own selfie right on the product page. For the demo we scroll to a recorded live run on a face that does not exist. The YouCam AI Aging Generator read him as 34 and projected him thirty years on. And the result already knows the product he was looking at."

**4. The slider (0:40 to 0:55)**

- Do: drag the divider across the face, between **As you live now** and **With daily SPF**.
- Show: the two captions under the slider, **Frame age 66** and **Frame age 58**.
- Say: "Left is the Aging Generator frame thirty years on, as he lives now: grey hair, deeper lines. Right is an earlier frame, 24% fewer years ahead, because the trial found 24% less skin aging with daily sunscreen. That trial measured skin texture, not years, so this is an illustration. AI Skin Simulation adds a light finishing pass on the SPF face. The caption stays on screen: illustrative projection, not a prognosis."

**5. Where 0.24 comes from (0:55 to 1:10)**

- Click: **Source** on the **Wrinkles** row. The card **Why this intensity · 0.24** opens.
- Say: "Every intensity has a source. Hughes and colleagues, Annals of Internal Medicine 2013: in a 4.5-year trial, daily sunscreen users showed 24% less skin aging than discretionary users. That 24% sets the earlier frame, and 0.24 is the finishing pass on the model's scale."
- Click anywhere outside the card to close it.

**6. The measured line (1:10 to 1:30)**

- Show: the card **Read by AI Skin Analysis**, **The measured line**, **Higher = better-looking skin**.
- Say: "AI Skin Analysis reads both renders. Wrinkles 21.6 to 61.0, texture 64.1 to 79.6, spots 63.4 to 83.7. Each number is the model's reading of a render, not a reading of you."

**7. Change the horizon (1:30 to 1:40)**

- Click: **+20 yrs**, then **+30 yrs**.
- Say: "Twenty years on the frames are 55 and 51, and wrinkles differ by plus 33.6. At thirty it is 66 against 58, and plus 39.4."

**8. UV where you live (1:40 to 1:50)**

- Show: the **UV today** card, **7.8**, **High UV**, **Nambour, Australia**, and **Weather data by Open-Meteo.com · CC BY 4.0**.
- Say: "The sun is local: the UV index comes from Open-Meteo. This recorded reading is from Nambour, Queensland, where the trial ran."

**9. The routine with this product (1:50 to 2:10)**

- Click: **Build my SPF routine**. The view moves to **Your routine for UV 7.8**.
- Show: three steps, **Morning**, **Midday top-up**, **Evening**, with real product photos. **Morning** is the product from the store page, with **SPF 50 covers a UV 7.8 day** and **View on Open Beauty Facts**.
- Say: "High UV, so SPF 50 every morning, and the product he was looking at covers it. A stick tops up at midday, a cleanser in the evening. Real products, no prices: the store sets those."

**10. Save and back to the store (2:10 to 2:30)**

- Click: **Save** on the **Midday top-up** product. It turns to **Saved**; **Your routine** shows **1 item**.
- Click: **Close Future Face** (the round button, top right). The window closes and the store page is back.
- Say: "Two faces, measured, then a routine sized to the sun where you live, right on the product page. Future Face, built on the YouCam AI Aging Generator, AI Skin Simulation and AI Skin Analysis."

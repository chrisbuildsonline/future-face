// Records today's UV for Nambour, Queensland (where the cited Hughes 2013 trial ran) into fixtures/demo/uv.json.
import { writeFileSync } from "node:fs";
import { getUv } from "../lib/uv";

const uv = await getUv("Nambour");
writeFileSync("fixtures/demo/uv.json", JSON.stringify({ ...uv, source: "recorded" }, null, 2) + "\n");
console.log(`wrote fixtures/demo/uv.json: ${uv.city}, ${uv.country} uv ${uv.uvMax} on ${uv.date}`);

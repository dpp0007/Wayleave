// Bakes the finishing passes into a saved run, so opening it in the app never spends credits:
//   gap filling (missing fees found on a second official page) -> Gemini double-check -> summary (FX cross-check, recommendation).
// Usage (against a running `next start` with both API keys set): node scripts/enrich.mjs public/demos/<file>.json
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

const file = process.argv[2], base = process.env.BASE || "http://localhost:3111";
if (!file) { console.error("usage: node scripts/enrich.mjs public/demos/<file>.json"); process.exit(1); }
const post = async (p, b) => { const r = await fetch(base + p, { method: "POST", body: JSON.stringify(b) }); const j = await r.json(); if (!r.ok) throw new Error(`${p}: ${j.error}`); return j; };

const d = JSON.parse(readFileSync(file, "utf8"));
for (const p of d.places) {
  const f = await post("/api/fill", { place: p.place, items: p.items });
  const v = await post("/api/verify", { place: p.place, items: f.items });
  p.items = v.status === "done" ? v.items : f.items;
  p.fill_stats = { tried: f.tried, filled: f.filled };
  p.gemini_model = v.model;
  console.log(`${p.place}: gap-filled ${f.filled}/${f.tried} ${JSON.stringify(f.stats)}, Gemini ${v.status}${v.model ? ` (${v.model})` : ""}`);
  await new Promise((r) => setTimeout(r, 15000)); // TinyFish Search allows ~30 requests a minute; a place uses up to 8
}
const out = await post("/api/summarize", { places: d.places.map(({ summary, ...p }) => p) });
writeFileSync(file, JSON.stringify({ ...d, ...out, enriched_at: new Date().toISOString() }, null, 2));
console.log(out.recommendation.text[0]);

// keep the picker index in step
const dir = file.replace(/[^/\\]+$/, "");
const idx = readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "index.json").map((f) => ({ file: f, activity: JSON.parse(readFileSync(dir + f, "utf8")).activity }));
writeFileSync(dir + "index.json", JSON.stringify(idx, null, 2));

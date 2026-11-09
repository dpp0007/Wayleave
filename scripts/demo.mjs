// Drives the app's own API routes end to end and saves the result: node scripts/demo.mjs "<activity>" Place1 Place2 Place3
import { mkdirSync, writeFileSync } from "node:fs";
const [activity, ...places] = process.argv.slice(2);
const base = process.env.BASE || "http://localhost:3111";
const post = async (p, b) => { const r = await fetch(base + p, { method: "POST", body: JSON.stringify(b) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; };

const start = await post("/api/start", { activity, places });
let ps = start.places.map((p) => ({ ...p, done: false, previewSent: false }));
while (ps.some((p) => !p.done)) {
  await new Promise((r) => setTimeout(r, 10000));
  for (const p of ps.filter((x) => !x.done)) {
    try {
      const j = await post("/api/poll", p);
      if (j.state === "final") { p.done = true; p.report = j.report; console.log(`${p.place}: FINAL ${j.report.level}, ${j.report.items.length} items`); }
      else { if (j.preview) { p.report = j.preview; p.previewSent = true; console.log(`${p.place}: preview ${j.preview.items.length} items`); } p.phase = j.phase; }
    } catch (e) { console.log(`${p.place}: poll error ${e.message}`); }
  }
  console.log(new Date().toISOString().slice(11, 19), ps.map((p) => `${p.place}=${p.done ? "done" : p.phase ?? "..."}`).join(" | "));
}
const data = await post("/api/summarize", { places: ps.map((p) => p.report) });
mkdirSync("public/demos", { recursive: true });
const slug = activity.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
writeFileSync(`public/demos/${slug}.json`, JSON.stringify({ activity, generated_at: new Date().toISOString(), ...data }, null, 2));
console.log("saved public/demos/" + slug + ".json\n" + data.recommendation.text.join("\n"));

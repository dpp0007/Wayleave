// Re-reads saved research runs for failed places (no new research is started) and recomputes summaries: node scripts/refresh.mjs demos/<file>.json
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
const file = process.argv[2], base = process.env.BASE || "http://localhost:3111";
const post = async (p, b) => { const r = await fetch(base + p, { method: "POST", body: JSON.stringify(b) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; };
const d = JSON.parse(readFileSync(file, "utf8"));
for (let n = 0; n < d.places.length; n++) {
  const p = d.places[n];
  const flaky = p.items?.some((i) => String(i.verification).startsWith("unreadable"));
  if ((p.level === "failed" || process.env.REVERIFY === "all" || (process.env.REVERIFY === "flaky" && flaky)) && p.research_run_id) {
    if (n) await new Promise((r) => setTimeout(r, 50000)); // stay under Fetch rate limits between places
    const j = await post("/api/poll", { place: p.place, researchId: p.research_run_id, agentId: null, startedAt: Date.now(), notes: [] });
    if (j.state === "final") { d.places[n] = j.report; console.log(`${p.place}: re-read -> ${j.report.level}, ${j.report.items.length} items`); }
  }
}
const out = await post("/api/summarize", { places: d.places.map(({ summary, ...p }) => p) });
writeFileSync(file, JSON.stringify({ ...d, ...out, generated_at: d.generated_at, refreshed_at: new Date().toISOString() }, null, 2));
console.log(out.recommendation.text.join("\n"));
// index for the UI sample picker
const dir = file.replace(/[^/\\]+$/, "");
const idx = readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "index.json").map((f) => ({ file: f, activity: JSON.parse(readFileSync(dir + f, "utf8")).activity }));
writeFileSync(dir + "index.json", JSON.stringify(idx, null, 2));

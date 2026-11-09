import type { GeminiItem } from "./gemini";
import { fetchPages } from "./tf";
import { KINDS } from "./types";

export type Level = "full" | "partial" | "quick" | "failed";
const OFFICIAL = new Set(["gov", "gob", "gouv", "govt", "government", "go", "gc", "admin", "europa", "gv", "overheid", "bund", "nyc", "mil", "state"]);

export const isOfficial = (url?: string) => {
  try { return new URL(url || "").hostname.split(".").slice(1).some((l) => OFFICIAL.has(l)); } catch { return false; }
};

/** Models often emit near-JSON: unescaped quotes inside quoted evidence, trailing commas, raw newlines. Repair line by line. */
function repairJson(s: string): string {
  return s.split("\n").map((line) => {
    const kv = line.match(/^(\s*"[A-Za-z_]+":\s*")(.*?)("\s*,?\s*)$/);   // "key": "value"[,]
    const el = line.match(/^(\s*")(.*?)("\s*,?\s*)$/);                   // bare string array element
    const m = kv || (line.trim().startsWith('"') && !/^\s*"[A-Za-z_]+":/.test(line) ? el : null);
    return m ? m[1] + m[2].replace(/\\"/g, "\u0001").replace(/"/g, '\\"').replace(/\u0001/g, '\\"') + m[3] : line;
  }).join("\n").replace(/,(\s*[}\]])/g, "$1");
}

export function parseJson(text?: string): any {
  if (!text) return null;
  const m = text.match(/```json\s*(\{[\s\S]*\})\s*```/) || text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
  const s = m ? m[1] : text.includes("{") ? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1) : "";
  try { return JSON.parse(s); } catch { /* fall through to repair */ }
  try { return JSON.parse(repairJson(s)); } catch { return null; }
}

const norm = (s?: string) => (s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
/** 'exact' if the quote is on the page, 'fuzzy' if >=80% of its words are, else 'missing'. */
export function verifyText(evidence: string, page: string): "exact" | "fuzzy" | "missing" {
  const e = norm(evidence), p = norm(page);
  if (!e.length) return "missing";
  if (p.join(" ").includes(e.join(" "))) return "exact";
  const ps = new Set(p);
  return e.filter((w) => ps.has(w)).length / e.length >= 0.8 ? "fuzzy" : "missing";
}

/** True if `n` appears on the page as an amount, i.e. not part of a longer number and not "36 months" / "20%" style quantities. */
export function costOnPage(n: number, text: string): boolean {
  const forms = [...new Set([String(n), n.toLocaleString("en-US"), n.toFixed(2)])].map((f) => f.replace(/[.,]/g, "\\$&"));
  const re = new RegExp(String.raw`(?<![\d,.])(?:${forms.join("|")})(?![\d])(?!\s*(?:%|(?:months?|years?|days?|weeks?|hours?|mins?|minutes?)\b))`, "i");
  return re.test(text);
}

/** Returns a corrected cost if some stated bound isn't an amount on the page (keeps only the supported bound(s)); null if all is supported. */
export function supportedCost(cost: any, text: string) {
  const bounds = [cost?.min, cost?.max].filter((v) => typeof v === "number" && v > 0);
  if (!bounds.length) return null;
  const ok = bounds.filter((v) => costOnPage(v, text));
  if (ok.length === bounds.length) return null;
  const lo = ok.length ? Math.min(...ok) : null, hi = ok.length ? Math.max(...ok) : null;
  return { min: lo, max: hi, currency: cost.currency };
}

/** The part of the live page around an item's claimed figures (so a fact-checker sees the real context, not just the quote). */
export function excerptFor(item: any, page: string, max = 900): string {
  const nums = [item.cost?.min, item.cost?.max].filter((v) => typeof v === "number" && v > 0);
  const spots: number[] = [];
  for (const n of nums) {
    for (const f of new Set([String(n), n.toLocaleString("en-US"), n.toFixed(2)])) {
      const at = page.indexOf(f);
      if (at >= 0) { spots.push(at); break; }
    }
  }
  if (!spots.length && item.evidence) {
    const at = page.toLowerCase().indexOf(String(item.evidence).toLowerCase().slice(0, 40));
    if (at >= 0) spots.push(at);
  }
  const each = Math.floor(max / Math.max(1, spots.length));
  return spots.slice(0, 2).map((at) => page.slice(Math.max(0, at - each / 2), at + each / 2).replace(/\s+/g, " ").trim()).join(" ... ");
}

const hasCost = (c: any) => c && (typeof c.min === "number" || typeof c.max === "number");

/** Fold Gemini's per-item verdicts into the items. A wrong fee is dropped from totals (kept as cost_unsupported); a suggested fix is
 *  accepted only if the corrected number really appears in the source text we hold; an unsure currency keeps the item out of USD totals. */
export function applyGemini(items: any[], by: Record<number, GeminiItem>) {
  return items.map((it, i) => {
    const g = by[i];
    if (!g) return it;
    const out: any = { ...it, gemini: { verdict: g.verdict, note: g.note, cost_ok: g.cost_ok, currency_ok: g.currency_ok, time_ok: g.time_ok } };
    if (g.cost_ok === false && hasCost(it.cost)) {
      const text = `${it.evidence ?? ""} ${it.excerpt ?? ""}`;
      const fix = g.fix_cost;
      const nums = fix ? [fix.min, fix.max].filter((n): n is number => typeof n === "number") : [];
      const fixed = nums.length && nums.every((n) => costOnPage(n, text)) ? { min: fix!.min, max: fix!.max, currency: fix!.currency || it.cost.currency } : null;
      out.cost_unsupported = it.cost_unsupported ?? it.cost;
      out.cost = fixed ?? { min: null, max: null, currency: it.cost.currency };
      if (fixed) out.cost_corrected = true;
    }
    if (g.currency_ok === false && hasCost(out.cost)) out.currency_unsure = true;
    return out;
  });
}

const SHAPE = `{"place": "<place>", "items": [{
  "step": 1, "kind": one of [${KINDS.join(", ")}], "name": "...", "authority": "issuing body",
  "cost": {"min": number|null, "max": number|null, "currency": "ISO code"},
  "time_days": {"min": number|null, "max": number|null}  (processing time until approval, in days - NOT validity period or renewal cycle),
  "renewal": "how often + renewal fee, or null", "ongoing_filing": "recurring filing/report + frequency, or null",
  "source_url": "the exact official page that states this", "evidence": "verbatim quote <=250 chars from that page",
  "status": "found" | "unclear"}],
 "gaps": ["each requirement, fee or processing time you could NOT confirm from an official page"]}`;
const RULES = `Rules: never estimate or infer a number - use null and list it in gaps. Every item needs its own source_url and a verbatim evidence quote. If sources conflict or a rule depends on facts about the business, set status "unclear" and say why in gaps. Keep local currency.`;

export const researchQuery = (activity: string, place: string, seeds: string[]) =>
  `Regulatory requirements for: "${activity}" in ${place}. Use ONLY official government/regulator sources (national, regional, municipal). ` +
  `Official pages to start from: ${seeds.slice(0, 6).join(", ") || "none found"}. ` +
  `List the licences, registrations, permits, inspections, tax registrations, insurance mandates and recurring filings a new operator needs, in order, max 12 items, most important first. ` +
  `For EVERY item, actively look for its official fee and official processing time - fee schedules and service-standard pages are often separate from the main guidance page, so search for them by name. Only use null when an official page truly does not state it. ` +
  `Be efficient: stop once the main requirements are confirmed. Return ONE \`\`\`json block, no other claims, exactly this shape:\n${SHAPE}\n${RULES}`;

export const agentGoal = (activity: string, place: string) =>
  `Read ONLY this one official page about starting "${activity}" in ${place}; do not click through to other pages. Be fast. Extract at most 6 of the most important requirements with the fees, processing times, renewals and recurring filings that THIS page states. Keep gaps to 3 short entries. ` +
  `Reply with JSON only, this shape (source_url = this page's URL):\n${SHAPE}\n${RULES}`;

export function normalizeItems(items: any[], defaultUrl?: string) {
  return (Array.isArray(items) ? items : []).filter((i) => i && typeof i === "object").map((i, n) => ({
    ...i, step: i.step ?? n + 1, name: i.name || "(unnamed)", source_url: i.source_url || defaultUrl,
    kind: (KINDS as readonly string[]).includes(i.kind) ? i.kind : "licence", cost: i.cost || {}, time_days: i.time_days || {},
  }));
}

/** Re-open each cited page live and check the quote is really there. Unreadable pages are flagged, never dropped. */
export async function verifyItems(items: any[]) {
  const urls = [...new Set(items.map((i) => i.source_url).filter(Boolean))] as string[];
  const pages: Record<string, string> = {}, errs: Record<string, string> = {};
  for (let k = 0; k < urls.length; k += 10) {
    const batch = urls.slice(k, k + 10);
    try {
      const r = await fetchPages(batch);
      for (const p of r.results ?? []) { pages[p.url] = pages[p.final_url] = typeof p.text === "string" ? p.text : ""; }
      for (const e of r.errors ?? []) errs[e.url] = e.error;
    } catch { batch.forEach((u) => (errs[u] = "fetch_failed")); }
  }
  const today = new Date().toISOString().slice(0, 10);
  return items.map((i) => {
    let v: string;
    if (!i.source_url || !i.evidence) v = "no_source";
    else if (i.source_url in pages) v = { exact: "verified", fuzzy: "verified_fuzzy", missing: "quote_not_on_page" }[verifyText(i.evidence, pages[i.source_url])];
    else v = `unreadable (${errs[i.source_url] ?? "not_fetched"})`;
    const out: any = { ...i, verification: v, official_domain: isOfficial(i.source_url), checked_at: today };
    if (i.source_url in pages) out.excerpt = excerptFor(i, pages[i.source_url]);
    // A fee bound the page doesn't state as an amount is dropped (kept as `cost_unsupported` for transparency), never summed.
    if (i.source_url in pages) {
      const sc = supportedCost(i.cost, pages[i.source_url]);
      if (sc) return { ...out, cost: sc, cost_unsupported: i.cost };
    }
    return out;
  });
}

const startupItems = (items: any[]) => items.filter((i) => i.kind !== "ongoing");
const isPriced = (i: any) => (typeof i.cost?.min === "number" || typeof i.cost?.max === "number") && !i.currency_unsure;

/** Start-up totals only: recurring ("ongoing") items are reported under renewals/filings, not summed into time-to-approval. */
export function totals(all: any[]) {
  const items = all.filter((i) => i.kind !== "ongoing");
  const num = (a: any, b: any) => (a ?? b ?? null);
  const costed = items.filter((i) => num(i.cost?.min, i.cost?.max) !== null && !i.currency_unsure);
  const timed = items.filter((i) => num(i.time_days?.min, i.time_days?.max) !== null);
  const cur = new Set(costed.map((i) => i.cost.currency || "?"));
  const sum = (xs: any[], k: "cost" | "time_days", w: "min" | "max") => xs.reduce((s, i) => s + (i[k][w] ?? i[k][w === "min" ? "max" : "min"]), 0);
  return {
    cost_min: sum(costed, "cost", "min"), cost_max: sum(costed, "cost", "max"),
    currency: cur.size === 1 ? [...cur][0] : cur.size ? "MIXED" : null, cost_items_unknown: items.length - costed.length,
    time_min_days: sum(timed, "time_days", "min"), time_max_days: sum(timed, "time_days", "max"), time_items_unknown: items.length - timed.length,
    time_longest_step_days: timed.length ? Math.max(...timed.map((i) => i.time_days.max ?? i.time_days.min)) : null,
  };
}

const usdRound = (x: number) => (x >= 100 ? Math.round(x) : Math.round(x * 100) / 100);

export function summarise(p: any, rates: Record<string, number>) {
  const t = totals(p.items), n = p.items.filter((i: any) => i.kind !== "ongoing").length || p.items.length;
  const ver = p.items.filter((i: any) => i.verification?.startsWith("verified") && i.gemini?.verdict !== "unsupported").length;
  const gem = { checked: p.items.filter((i: any) => i.gemini).length, supported: p.items.filter((i: any) => i.gemini?.verdict === "supported").length,
    partly: p.items.filter((i: any) => i.gemini?.verdict === "partly").length, unsupported: p.items.filter((i: any) => i.gemini?.verdict === "unsupported").length,
    currency_unsure: p.items.filter((i: any) => i.currency_unsure).length, corrected: p.items.filter((i: any) => i.cost_corrected).length };
  const rate = t.currency && t.currency !== "MIXED" ? rates[t.currency] : undefined;
  const usable = rate && t.cost_items_unknown < n;
  const denom = p.items.length + p.gaps.length;
  return {
    ...t, steps: n || null, usd_min: usable ? usdRound(t.cost_min / rate!) : null, usd_max: usable ? usdRound(t.cost_max / rate!) : null,
    time_max_days: n && t.time_items_unknown < n ? t.time_max_days : null,
    items_unknown: { cost: t.cost_items_unknown, time: t.time_items_unknown },
    priced_items: startupItems(p.items).filter(isPriced).map((i: any) => ({ name: i.name, min: i.cost.min ?? i.cost.max, max: i.cost.max ?? i.cost.min, currency: i.cost.currency, source_url: i.source_url }))
      .sort((a: any, b: any) => b.max - a.max),
    unpriced_items: startupItems(p.items).filter((i: any) => !isPriced(i)).map((i: any) => ({ name: i.name, source_url: i.source_url })),
    verified: ver, gemini: gem, gaps: p.gaps.length, confidence: denom ? ver / denom : 0,
    renewals: p.items.filter((i: any) => i.renewal).map((i: any) => ({ name: i.name, renewal: i.renewal, source_url: i.source_url })),
    ongoing_filings: p.items.filter((i: any) => i.ongoing_filing).map((i: any) => ({ name: i.name, filing: i.ongoing_filing, source_url: i.source_url })),
  };
}

const mm = (vals: (number | null)[]) => {
  const ok = vals.filter((v): v is number => v !== null);
  const lo = Math.min(...ok), hi = Math.max(...ok);
  return vals.map((v) => (v === null ? null : hi === lo ? 0.5 : (v - lo) / (hi - lo)));
};

export type Point = { tone: "good" | "warn" | "bad"; text: string };

/** Transparent weighted score. Failed/empty places are excluded; missing data is never rewarded as "cheap". */
export function recommend(places: any[], weights: Partial<Record<string, number>> = {}) {
  const w: Record<string, number> = { cost: 0.35, time: 0.3, steps: 0.15, confidence: 0.2, ...weights };
  const assessed = places.filter((p) => p.level !== "failed" && p.items.length);
  // A place covered only by a one-page quick read is too thin to rank against deep research (it would "win" on having fewer steps).
  const deep = assessed.filter((p) => p.level !== "quick");
  const live = deep.length >= 2 ? deep : assessed;
  const thin = assessed.filter((p) => !live.includes(p)).map((p) => p.place);
  const excluded = places.filter((p) => !assessed.includes(p)).map((p) => p.place);
  const points: Point[] = [];
  const add = (tone: Point["tone"], text: string) => points.push({ tone, text });
  const result = (ranking: any[], headline: string, provisional: boolean, lead: string) =>
    ({ ranking, weights: w, headline, provisional, points, text: [lead, ...points.map((p) => p.text)] });

  if (excluded.length) add("bad", `Not assessed (excluded from ranking): ${excluded.join(", ")} - research could not be completed.`);
  if (thin.length) add("warn", `${thin.join(", ")}: only a quick single-page read, too thin to rank against deep research. Try again for a full comparison.`);
  if (live.length < 2) {
    add("warn", "Not enough assessed places to recommend. Retry, or confirm manually.");
    return result([], "Not enough data", true, "Not enough data to recommend.");
  }
  // A metric is only comparable if most items state it. Otherwise "unstated" would look cheap/fast, so it is not scored.
  const covered = (p: any, unknown: string) => p.summary.steps && 1 - p.summary.items_unknown?.[unknown] / p.summary.steps >= 0.5;
  const gate = (metric: "cost" | "time", f: string) => {
    const vals = live.map((p) => (covered(p, metric) ? p.summary[f] : null));
    return vals.filter((v) => v !== null).length >= 2 ? vals : vals.map(() => null);
  };
  const cols: Record<string, (number | null)[]> = {
    cost: mm(gate("cost", "usd_max")), time: mm(gate("time", "time_max_days")), steps: mm(live.map((p) => p.summary.steps)),
  };
  for (const [k, label] of [["cost", "Cost"], ["time", "Time"]] as const)
    if (cols[k].every((v) => v === null)) add("warn", `${label} was NOT scored: fewer than two places have official ${k === "cost" ? "fees" : "processing times"} stated for at least half their steps. Totals below are partial ("at least").`);
  const ranking = live.map((p, i) => {
    const parts: Record<string, number | null> = {};
    for (const k of Object.keys(cols)) parts[k] = cols[k][i] === null ? null : 1 - (cols[k][i] as number);
    parts.confidence = p.summary.confidence;
    const used = Object.keys(parts).filter((k) => parts[k] !== null);
    const score = used.reduce((s, k) => s + w[k] * (parts[k] as number), 0) / used.reduce((s, k) => s + w[k], 0);
    return { place: p.place, level: p.level, score: Math.round(score * 1000) / 1000, missing: Object.keys(parts).filter((k) => parts[k] === null) };
  }).sort((a, b) => b.score - a.score);
  const by = Object.fromEntries(live.map((p) => [p.place, p.summary]));
  const [best, other] = ranking;
  const idx = (pl: string) => live.findIndex((p) => p.place === pl);
  const scored = (f: string, pl: string) => cols[f === "usd_max" ? "cost" : f === "time_max_days" ? "time" : "steps"][idx(pl)] !== null;
  const provisional = !!best.missing.length || by[best.place].confidence < 0.5;
  const lead = `${provisional ? "Provisional - " : ""}Easiest place to start on the evidence gathered: ${best.place} (score ${best.score})${best.missing.length ? `; note ${best.missing.join(" and ")} could not be scored for it` : ""}.`;
  const a = by[best.place], b = by[other.place];
  if (best.score - other.score < 0.05) add("warn", `Close call with ${other.place} (${other.score}); decide on factors this tool can't see.`);
  for (const [label, f, unit] of [["Cost", "usd_max", " USD upper bound (FX-converted)"], ["Time", "time_max_days", " days upper bound (steps summed)"], ["Steps", "steps", ""]] as const)
    if (a[f] != null && b[f] != null && a[f] !== b[f] && scored(f, best.place) && scored(f, other.place)) add("good", `${label}: ${best.place} ${a[f]}${unit} vs ${other.place} ${b[f]}${unit}.`);
  if (a.confidence < b.confidence) add("warn", `Trade-off: ${other.place} is better sourced (${Math.round(b.confidence * 100)}% verified vs ${Math.round(a.confidence * 100)}%).`);
  for (const r of ranking) {
    const m = r.missing.filter((k) => cols[k].some((v) => v !== null)); // only call out places left out of a metric others were scored on
    if (m.length) add("warn", `${r.place}: ${m.join(", ")} not scored (too little stated on official pages); not rewarded for that gap.`);
    if (r.level === "quick" || r.level === "partial") add("warn", `${r.place}: ${r.level === "quick" ? "quick single-page read only" : "deep research hit its deadline, partial"} - lower confidence.`);
    if (by[r.place].gaps) add("warn", `${r.place} has ${by[r.place].gaps} flagged gap(s) - confirm with a local lawyer.`);
  }
  add("warn", "Costs/times are what official pages state; real timelines vary. Hand this to a lawyer to confirm.");
  return result(ranking, best.place, provisional, lead);
}

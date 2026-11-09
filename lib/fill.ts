// Gap filling: for start-up steps whose fee or time is not stated, look for it on a second official page and verify it.
//
//   Search (restricted to the place's official hosts) -> Fetch the candidate pages -> Gemini extracts a fee or time FROM THOSE PAGES ONLY
//   -> the server accepts it only if the quote is really on the page and the amount is in the quote. Otherwise the gap stays a gap.
//
// The pure parts (pickTargets, keywordWindows, applyFill) are tested offline; fillGaps is the network orchestration around them.
import { geminiConfigured, geminiExtract } from "./gemini";
import { costOnPage, isOfficial, verifyText } from "./logic";
import { fetchPages, search } from "./tf";
import { safeUrl } from "./validate";

const ORDER = ["registration", "licence", "inspection", "tax", "insurance"];
const FEE_WORDS = /fee|charge|cost|price|payable|rate|processing|working days|business days|calendar days|\$|£|€|₹|\brs\.?\b|\baed\b|\bdhs\b|\binr\b|\bsgd\b|\bgbp\b|\busd\b/gi;
const hostOf = (u?: string) => { try { return new URL(u || "").hostname; } catch { return ""; } };
const hasAny = (o: any) => o && (typeof o.min === "number" || typeof o.max === "number");

export type Target = { i: number; name: string; kind: string; source_url?: string };

/** Up to `max` start-up steps with no stated fee, most important kinds first. Recurring duties are not chased. */
export function pickTargets(items: any[], max = 4): Target[] {
  return items.map((it, i) => ({ it, i }))
    .filter(({ it }) => it.kind !== "ongoing" && !hasAny(it.cost) && !it.filled && it.name)
    .sort((a, b) => ORDER.indexOf(a.it.kind) - ORDER.indexOf(b.it.kind) || (a.it.step ?? 0) - (b.it.step ?? 0))
    .slice(0, max).map(({ it, i }) => ({ i, name: it.name, kind: it.kind, source_url: it.source_url }));
}

/** The few stretches of a page that look like fee or processing-time text, richest in numbers first, so the model reads facts not menus. */
export function keywordWindows(text: string, n = 3, width = 700): string {
  const t = text.slice(0, 80_000), spots: { at: number; score: number }[] = [];
  let last = -width;
  for (const m of t.matchAll(FEE_WORDS)) {
    const at = Math.max(0, (m.index ?? 0) - 250);
    if (at - last < width) continue; // overlaps the previous window
    last = at;
    spots.push({ at, score: (t.slice(at, at + width).match(/\d/g) || []).length });
  }
  return spots.sort((a, b) => b.score - a.score).slice(0, n).sort((a, b) => a.at - b.at)
    .map((s) => t.slice(s.at, s.at + width).replace(/\s+/g, " ").trim()).join(" … ");
}

const parse = (v: unknown) => { const n = parseFloat(String(v ?? "").replace(/,/g, "")); return Number.isFinite(n) && n >= 0 && n < 1e9 ? n : null; };
const digitToken = (n: number, text: string) => new RegExp(String.raw`(?<![\d.,])${String(n).replace(".", "\\.")}(?![\d])`).test(text);

export type FillRow = { i: number; found: boolean; url?: string; fee_min?: string; fee_max?: string; currency?: string; days_min?: string; days_max?: string; quote?: string };

/**
 * Accepts a found fee or time only when it is backed by the page: the quote must be on the page (verbatim or close), and every number
 * reported must appear in that quote (a fee as an amount, not as "36 months"). Anything else is rejected and the step stays a gap.
 */
export function applyFill(items: any[], rows: FillRow[], textByUrl: Record<string, string>, today = new Date().toISOString().slice(0, 10)) {
  const out = [...items], rejected: { i: number; reason: string }[] = [];
  const currencies = items.map((i) => i.cost?.currency).filter(Boolean) as string[];
  const placeCurrency = [...new Set(currencies)].sort((a, b) => currencies.filter((c) => c === b).length - currencies.filter((c) => c === a).length)[0];
  let filled = 0;
  for (const r of rows) {
    const it = items[r.i];
    if (!it || !r.found) continue;
    const text = r.url ? textByUrl[r.url] : undefined, url = safeUrl(r.url), quote = String(r.quote ?? "").slice(0, 300);
    if (!text || !url || !quote) { rejected.push({ i: r.i, reason: "no page or quote" }); continue; }
    if (verifyText(quote, text) === "missing") { rejected.push({ i: r.i, reason: "quote not on page" }); continue; }
    const fee = [parse(r.fee_min), parse(r.fee_max)], days = [parse(r.days_min), parse(r.days_max)];
    const hasFee = fee.some((n) => n !== null), hasDays = days.some((n) => n !== null);
    if (!hasFee && !hasDays) { rejected.push({ i: r.i, reason: "nothing reported" }); continue; }
    if (fee.some((n) => n !== null && !costOnPage(n, quote))) { rejected.push({ i: r.i, reason: "amount not in quote" }); continue; }
    if (fee.some((n) => n === 0) && !/\b(free|no (fee|charge|cost)|nil|waived|exempt|without charge)\b/i.test(quote)) { rejected.push({ i: r.i, reason: "zero fee not stated as free" }); continue; }
    if (days.some((n) => n !== null && !digitToken(n, quote))) { rejected.push({ i: r.i, reason: "days not in quote" }); continue; }
    const iso = /^[A-Za-z]{3}$/.test(String(r.currency ?? "").trim()) ? String(r.currency).trim().toUpperCase() : undefined;
    const currency = iso ?? it.cost?.currency ?? placeCurrency;
    if (hasFee && !currency) { rejected.push({ i: r.i, reason: "currency unknown" }); continue; }
    const fields: string[] = [];
    const next: any = { ...it };
    if (hasFee) { next.cost = { min: fee[0] ?? fee[1], max: fee[1] ?? fee[0], currency }; delete next.cost_unsupported; fields.push("fee"); }
    if (hasDays && !hasAny(it.time_days)) { next.time_days = { min: days[0] ?? days[1], max: days[1] ?? days[0] }; fields.push("time"); }
    if (!fields.length) { rejected.push({ i: r.i, reason: "already stated" }); continue; }
    next.filled = { url, quote, fields, checked_at: today, currency_inferred: hasFee && !iso && !it.cost?.currency };
    next.excerpt = `${quote} … ${it.excerpt ?? ""}`.slice(0, 900); // so the Gemini check afterwards reads the new evidence too
    out[r.i] = next; filled++;
  }
  return { items: out, filled, rejected };
}

const within = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

/** Search -> Fetch -> Gemini -> verify, inside one serverless call (about 50s budget). Never throws: on any failure the gaps simply stay. */
export async function fillGaps(place: string, items: any[]) {
  const t0 = Date.now(), targets = pickTargets(items);
  const stats = { searched: 0, searchFailed: 0, urls: 0, pages: 0, packs: 0, rows: 0, found: 0 }; // where the pipeline narrowed, for diagnosis
  if (!targets.length || !geminiConfigured()) return { items, tried: 0, filled: 0, rejected: 0, stats };
  try {
    const hosts = [...new Set(items.map((i) => hostOf(i.source_url)).filter((h) => h && isOfficial(`https://${h}`)))].slice(0, 8);
    // Two searches per step: one limited to hosts already cited, one open (fee schedules often sit on a different official site, so
    // results are kept only if they look official). Own cited page first, then up to two hits from each search.
    const official = (u: string | undefined): u is string => !!u && (isOfficial(u) || hosts.includes(hostOf(u)));
    const top = (r: PromiseSettledResult<any[]>) => (r.status === "fulfilled" ? r.value.map((h) => safeUrl(h.url)).filter(official).slice(0, 2) : []);
    const found = await Promise.all(targets.map(async (t) => {
      const [near, wide] = await Promise.allSettled([
        within(search(`${t.name} fee charges processing time ${place}`, hosts), 10_000),
        within(search(`${t.name} official fee schedule ${place}`), 10_000),
      ]);
      stats.searchFailed += [near, wide].filter((r) => r.status === "rejected").length;
      return { t, urls: [...new Set([t.source_url, ...top(near), ...top(wide)].filter((u): u is string => !!u))].slice(0, 4) };
    }));
    const urls = [...new Set(found.flatMap((f) => f.urls))].slice(0, 16);
    stats.searched = found.filter((f) => f.urls.length).length; stats.urls = urls.length;
    const textByUrl: Record<string, string> = {};
    // Fetch accepts 10 URLs per request, so large sets go as parallel batches
    const batches = Array.from({ length: Math.ceil(urls.length / 10) }, (_, k) => urls.slice(k * 10, k * 10 + 10));
    await Promise.all(batches.map(async (batch) => {
      try {
        const r = await within(fetchPages(batch, 15_000), 28_000);
        for (const p of r.results ?? []) textByUrl[p.url] = textByUrl[p.final_url ?? p.url] = typeof p.text === "string" ? p.text : "";
      } catch { /* this batch failed: its pages are simply not read */ }
    }));
    stats.pages = Object.keys(textByUrl).length;
    const packs = found.map(({ t, urls }) => ({ i: t.i, name: t.name, kind: t.kind,
      sources: urls.filter((u) => textByUrl[u]).map((u) => ({ url: u, excerpt: keywordWindows(textByUrl[u]) })).filter((s) => s.excerpt) })).filter((p) => p.sources.length);
    stats.packs = packs.length;
    if (!packs.length) return { items, tried: targets.length, filled: 0, rejected: 0, stats };
    const rows = await geminiExtract(place, packs, Math.max(8_000, 52_000 - (Date.now() - t0)));
    if (!rows) return { items, tried: targets.length, filled: 0, rejected: 0, stats };
    stats.rows = rows.length; stats.found = rows.filter((r) => r.found).length;
    const resolved: FillRow[] = rows.map((r) => ({ ...r, url: packs.find((p) => p.i === r.i)?.sources[r.source]?.url }));
    const res = applyFill(items, resolved, textByUrl);
    return { items: res.items, tried: targets.length, filled: res.filled, rejected: res.rejected.length, stats };
  } catch { return { items, tried: targets.length, filled: 0, rejected: 0, stats }; }
}

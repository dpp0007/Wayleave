import { api } from "@/lib/api";
import { fxTable } from "@/lib/fx";
import { fail } from "@/lib/guard";
import { recommend, summarise } from "@/lib/logic";
import { MAX_PLACES } from "@/lib/types";
import { cleanText, itemsOf } from "@/lib/validate";

const LEVELS = new Set(["full", "partial", "quick", "failed"]);

// Pure computation over places already gathered; cheap, so the UI calls it after every place update.
// Currencies are converted with the primary live rate and cross-checked against independent sources (see lib/fx.ts).
export const POST = api("summarize", async (b) => {
  if (!Array.isArray(b?.places) || b.places.length === 0 || b.places.length > MAX_PLACES) return fail(400, "Invalid request.");
  const places: any[] = [];
  for (const p of b.places) {
    const name = cleanText(p?.place, 2, 80), items = itemsOf(p?.items);
    if (!name || !items || !LEVELS.has(p?.level)) return fail(400, "Invalid request.");
    places.push({ ...p, place: name, items, gaps: (Array.isArray(p.gaps) ? p.gaps : []).filter((g: unknown) => typeof g === "string").slice(0, 40) });
  }
  const fx = await fxTable(places.flatMap((p) => p.items.map((i: any) => i.cost?.currency).filter((c: unknown) => typeof c === "string")));
  const withSummary = places.map((p) => ({ ...p, summary: summarise(p, fx.rates) }));
  const used = new Set(withSummary.map((p) => p.summary.currency));
  return { places: withSummary, recommendation: recommend(withSummary), fx: { ok: fx.ok, asof: fx.asof, rows: fx.rows.filter((r) => used.has(r.currency)) } };
}, { maxBytes: 600_000, access: false }); // no paid APIs here, so it stays open (rate-limited) even when ACCESS_CODE is set

import { NextResponse } from "next/server";
import { fxTable } from "@/lib/fx";
import { recommend, summarise } from "@/lib/logic";

// Pure computation over places already gathered; cheap, so the UI calls it after every place update.
// Currencies are converted with the primary live rate and cross-checked against independent sources (see lib/fx.ts).
export async function POST(req: Request) {
  const { places, weights } = await req.json();
  const currencies = places.flatMap((p: any) => p.items.map((i: any) => i.cost?.currency).filter(Boolean));
  const fx = await fxTable(currencies);
  const withSummary = places.map((p: any) => ({ ...p, summary: summarise(p, fx.rates) }));
  const used = new Set(withSummary.map((p: any) => p.summary.currency));
  return NextResponse.json({
    places: withSummary, recommendation: recommend(withSummary, weights),
    fx: { ok: fx.ok, asof: fx.asof, rows: fx.rows.filter((r) => used.has(r.currency)) },
  });
}

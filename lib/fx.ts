// Exchange-rate cross-check. USD figures shown in the app come from the primary source; every currency used is compared against
// independent live sources, and a currency whose sources disagree is flagged instead of silently converted.
type FxSource = { name: string; per_usd: number };
export type FxRow = { currency: string; per_usd: number; sources: FxSource[]; max_dev_pct: number; status: "ok" | "diverge" | "single_source" };

const TOLERANCE_PCT = 1.5; // normal day-to-day differences between providers are well under 1%

/** Pure: compare one currency across sources. The first source is the primary (used for conversion). */
export function fxRow(currency: string, sources: FxSource[]): FxRow {
  const per = sources[0]?.per_usd ?? NaN;
  const dev = sources.slice(1).map((s) => Math.abs(s.per_usd - per) / per * 100);
  const max = dev.length ? Math.max(...dev) : 0;
  return { currency, per_usd: per, sources, max_dev_pct: Math.round(max * 100) / 100, status: !dev.length ? "single_source" : max > TOLERANCE_PCT ? "diverge" : "ok" };
}

async function getJson(url: string): Promise<any> {
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

type Snapshot = { t: number; ttl: number; asof: string; sources: { name: string; rates: Record<string, number> }[] };
let cache: Snapshot | null = null;

async function snapshot(): Promise<Snapshot> {
  if (cache && Date.now() - cache.t < cache.ttl) return cache;
  const [a, b, c] = await Promise.allSettled([
    getJson("https://open.er-api.com/v6/latest/USD").then((j) => ({ name: "open.er-api.com", rates: j.rates as Record<string, number> })),
    getJson("https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json").then((j) => ({ name: "currency-api (jsDelivr)", rates: Object.fromEntries(Object.entries(j.usd as Record<string, number>).map(([k, v]) => [k.toUpperCase(), v])) })),
    getJson("https://api.frankfurter.dev/v1/latest?base=USD").then((j) => ({ name: "ECB via Frankfurter", rates: j.rates as Record<string, number> })),
  ]);
  const sources = [a, b, c].flatMap((x) => (x.status === "fulfilled" && x.value.rates ? [x.value] : []));
  const snap: Snapshot = { t: Date.now(), ttl: sources.length >= 2 ? 3600_000 : 120_000, asof: new Date().toISOString().slice(0, 10), sources };
  if (sources.length) cache = snap;             // an empty result is never cached: one network blip must not hide rates for an hour
  return sources.length ? snap : cache ?? snap; // all providers down: serve the last good snapshot if there is one
}

/** Rates (per 1 USD) for conversion plus a cross-check row for every currency requested. */
export async function fxTable(currencies: string[]) {
  const snap = await snapshot().catch(() => null);
  const rates: Record<string, number> = {};
  const rows: FxRow[] = [];
  if (!snap || !snap.sources.length) return { rates, rows, asof: "", ok: false };
  for (const cur of [...new Set(currencies.filter((c) => c && c !== "MIXED" && c !== "?"))]) {
    if (cur === "USD") continue;
    const sources = snap.sources.flatMap((s) => (typeof s.rates[cur] === "number" ? [{ name: s.name, per_usd: s.rates[cur] }] : []));
    if (!sources.length) continue;
    const row = fxRow(cur, sources);
    rows.push(row);
    rates[cur] = row.per_usd;
  }
  return { rates, rows, asof: snap.asof, ok: true };
}

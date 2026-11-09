import type { Data, PlaceState } from "@/lib/types";
import { Badge, Card, Eyebrow, Spinner } from "../ui";

/** "How this was checked": sources re-read live, Gemini's second opinion on the figures, and the exchange-rate cross-check. */
export default function Checks({ data, states }: { data: Data; states: PlaceState[] }) {
  const items = data.places.flatMap((p) => p.items);
  const live = items.filter((i) => i.verification?.startsWith("verified")).length;
  const badQuote = items.filter((i) => i.verification === "quote_not_on_page").length;
  const unread = items.filter((i) => String(i.verification).startsWith("unreadable")).length;
  const g = data.places.reduce((a, p) => ({ checked: a.checked + p.summary.gemini.checked, supported: a.supported + p.summary.gemini.supported, partly: a.partly + p.summary.gemini.partly,
    unsupported: a.unsupported + p.summary.gemini.unsupported, corrected: a.corrected + p.summary.gemini.corrected, currency: a.currency + p.summary.gemini.currency_unsure }),
    { checked: 0, supported: 0, partly: 0, unsupported: 0, corrected: 0, currency: 0 });
  const pending = states.some((s) => s.gemini === "pending");
  const tried = states.reduce((n, s) => n + (s.fillStats?.tried ?? 0), 0), found = items.filter((i) => i.filled).length;
  const model = states.find((s) => s.geminiModel)?.geminiModel;
  const reason = states.find((s) => s.gemini === "unavailable")?.geminiNote;

  return (
    <Card className="animate-rise">
      <Eyebrow>How this was checked</Eyebrow>
      <div className="mt-3 grid gap-6 md:grid-cols-3">
        <div>
          <h3 className="text-base">Sources, re-read live</h3>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{live}<span className="text-base font-normal text-mut"> of {items.length} items</span></p>
          <p className="mt-1 text-sm text-mut">The cited official page was opened again and the quoted text found on it.{badQuote > 0 && ` ${badQuote} quote${badQuote > 1 ? "s" : ""} not found.`}{unread > 0 && ` ${unread} page${unread > 1 ? "s" : ""} unreadable.`}</p>
          {tried > 0 && <p className="mt-2 text-sm text-mut"><b className="font-semibold text-ink">Gap filling:</b> a second official page was searched for {tried} unpriced step{tried > 1 ? "s" : ""}; {found} fee or time found and verified. The rest stay marked as gaps.</p>}
        </div>

        <div>
          <h3 className="flex items-center gap-2 text-base">Gemini double-check {pending && <Spinner className="text-accent" />}</h3>
          {g.checked > 0 ? <>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{g.supported}<span className="text-base font-normal text-mut"> of {g.checked} fully supported</span></p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {g.partly > 0 && <Badge tone="warn">{g.partly} partly</Badge>}
              {g.unsupported > 0 && <Badge tone="bad">{g.unsupported} unsupported</Badge>}
              {g.corrected > 0 && <Badge tone="accent">{g.corrected} fee corrected</Badge>}
              {g.currency > 0 && <Badge tone="warn">{g.currency} currency unsure</Badge>}
              {g.partly + g.unsupported + g.currency === 0 && <Badge tone="ok">No issues found</Badge>}
            </div>
            <p className="mt-2 text-sm text-mut">Fees, currencies and times were compared with the page text{model ? ` by ${model}` : ""}. A correction is only accepted if the new number is in the source; an unsure currency is kept out of totals.</p>
          </> : <p className="mt-1 text-sm text-mut">{pending ? "Checking figures against the page text…" : `Not run${reason ? ` (${reason})` : ""}. The page check above still applies.`}</p>}
        </div>

        <div>
          <h3 className="text-base">Currency</h3>
          {data.fx.rows.length > 0 ? <>
            <ul className="mt-2 space-y-1.5 text-sm">
              {data.fx.rows.map((r) => (
                <li key={r.currency} className="flex items-center justify-between gap-2">
                  <span className="tabular-nums">1 USD = {r.per_usd.toLocaleString("en-US", { maximumFractionDigits: 4 })} {r.currency}</span>
                  <Badge tone={r.status === "ok" ? "ok" : r.status === "diverge" ? "bad" : "warn"} title={r.sources.map((s) => `${s.name}: ${s.per_usd}`).join("\n")}>
                    {r.status === "ok" ? `${r.sources.length} sources agree` : r.status === "diverge" ? `sources disagree ${r.max_dev_pct}%` : "1 source only"}
                  </Badge>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-faint">Live rates as of {data.fx.asof}. USD figures are indicative; the local-currency totals are the ones to rely on.</p>
          </> : <p className="mt-1 text-sm text-mut">{data.fx.ok ? "All figures are in one currency or have no USD conversion." : "Exchange rates were unavailable, so no USD figures are shown."}</p>}
        </div>
      </div>
    </Card>
  );
}

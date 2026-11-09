"use client";
import { useState } from "react";
import { Card, Eyebrow, cx } from "../ui";
import { safeUrl } from "@/lib/validate";
import { usd } from "./PlaceCards";

const num = (n: any) => (typeof n === "number" ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : n);
const amount = (x: any) => `${x.min === x.max ? num(x.max) : `${num(x.min)}–${num(x.max)}`} ${x.currency ?? ""}`.trim();

// Costs no official page will list for you. They are real, so the totals above are a floor.
const LEFT_OUT = ["renewal and recurring fees (listed in the table)", "professional or agent fees", "premises, deposits, fit-out and equipment", "insurance premiums", "taxes on sales and payroll"];

function PlaceCosts({ p }: { p: any }) {
  const s = p.summary;
  const [all, setAll] = useState(false);
  const priced: any[] = s.priced_items, unpriced: any[] = s.unpriced_items;
  const steps = priced.length + unpriced.length, pct = steps ? Math.round((priced.length / steps) * 100) : 0;
  const shown = all ? priced : priced.slice(0, 4);
  return (
    <div className="rounded-xl border border-line bg-sunk/50 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="font-serif text-base font-semibold">{p.place}</h4>
        <span className={cx("text-xs font-medium tabular-nums", unpriced.length ? "text-warn" : "text-ok")}>{priced.length} of {steps} priced</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden><div className={cx("h-full rounded-full", unpriced.length ? "bg-warn" : "bg-ok")} style={{ width: `${pct}%` }} /></div>

      {priced.length > 0 ? (
        <ul className="mt-3 space-y-1.5 text-sm">
          {shown.map((x, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate" title={x.name}>{x.name}</span>
              <span className="flex shrink-0 items-baseline gap-1.5 tabular-nums">
                <b className="font-semibold">{amount(x)}</b>
                {x.source_url && <a href={safeUrl(x.source_url)} target="_blank" rel="noopener noreferrer" aria-label={`Source for ${x.name}`} className="text-xs text-accent">↗</a>}
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 text-sm text-mut">No start-up fee is stated on the official pages found.</p>}
      {priced.length > 4 && <button type="button" onClick={() => setAll(!all)} className="mt-2 text-xs font-medium text-accent">{all ? "Show fewer" : `+${priced.length - 4} more priced steps`}</button>}

      {unpriced.length > 0 && (
        <details className="mt-3 rounded-lg bg-warn-soft/60 px-3 py-2 text-xs">
          <summary className="cursor-pointer font-medium text-warn">{unpriced.length} step{unpriced.length > 1 ? "s" : ""} with no stated fee</summary>
          <ul className="mt-1.5 space-y-1 text-mut">{unpriced.map((x, i) => <li key={i}>· {x.name}</li>)}</ul>
        </details>
      )}
      {s.usd_max != null && <p className="mt-3 text-xs text-faint">Stated fees total ≈ {s.usd_min === s.usd_max ? usd(s.usd_max) : `${usd(s.usd_min)}–${usd(s.usd_max)}`} USD</p>}
    </div>
  );
}

/** Where the money goes: the stated fee behind each total, and what the total leaves out. Read the totals as a floor, not a budget. */
export default function CostBreakdown({ places }: { places: any[] }) {
  return (
    <Card className="animate-rise">
      <Eyebrow>Where the costs go</Eyebrow>
      <h3 className="mt-1 text-xl">The totals are a floor, not a budget</h3>
      <p className="mt-1 max-w-3xl text-sm text-mut">Each total adds up only the fees an official page states. Steps with no stated fee still cost something, and so does everything below. Here is what makes up each number, biggest first.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{places.map((p) => <PlaceCosts key={p.place} p={p} />)}</div>
      <div className="mt-4 rounded-xl border border-dashed border-line2 px-4 py-3 text-sm">
        <b className="font-semibold">Not in any total:</b> <span className="text-mut">{LEFT_OUT.join(" · ")}. Ask a local professional for a quote on these.</span>
      </div>
    </Card>
  );
}

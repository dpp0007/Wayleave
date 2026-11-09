"use client";
import { useState, type ReactNode } from "react";
import { KINDS, KIND_LABEL, LEVEL, type Data } from "@/lib/types";
import { Badge, SectionTitle, cx } from "../ui";
import { usd } from "./PlaceCards";

const num = (n: any) => (typeof n === "number" ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : n);
const range = (a: any, b: any) => (a == null && b == null ? null : a === b || b == null ? num(a) : a == null ? num(b) : `${num(a)}–${num(b)}`);
const COMPACT = 3; // items shown per cell before "+N more"

/** Everything worth a second look on one item, in plain words. Empty means every check passed. */
function issuesOf(i: any): { text: string; severe: boolean }[] {
  const out: { text: string; severe: boolean }[] = [], v = String(i.verification);
  if (v === "quote_not_on_page") out.push({ text: "the quote is not on the cited page", severe: true });
  else if (v.startsWith("unreadable")) out.push({ text: "the cited page could not be read", severe: false });
  else if (v === "no_source") out.push({ text: "no source", severe: true });
  if (i.gemini?.verdict === "unsupported") out.push({ text: "Gemini: the figures are not supported", severe: true });
  else if (i.gemini?.verdict === "partly") out.push({ text: "Gemini: partly supported", severe: false });
  if (i.cost_unsupported && !i.cost_corrected) out.push({ text: "the claimed fee is not on the page (left out of totals)", severe: true });
  if (i.currency_unsure) out.push({ text: "currency unsure (left out of USD totals)", severe: false });
  if (i.status === "unclear") out.push({ text: "the rule is unclear", severe: false });
  if (!i.official_domain) out.push({ text: "check the host is an official site", severe: false });
  return out;
}

const hasFee = (i: any) => i.cost && (typeof i.cost.min === "number" || typeof i.cost.max === "number");
const hasTime = (i: any) => i.time_days && (typeof i.time_days.min === "number" || typeof i.time_days.max === "number");
/** Items with a fee or time, or something to check, come first; step order breaks ties. */
const weight = (i: any) => (hasFee(i) ? 2 : 0) + (hasTime(i) ? 1 : 0) + (issuesOf(i).length ? 1 : 0);

function Item({ i, open }: { i: any; open: boolean }) {
  const c = i.cost || {}, t = i.time_days || {};
  const cost = range(c.min, c.max), time = range(t.min, t.max), issues = issuesOf(i), severe = issues.some((x) => x.severe);
  return (
    <details open={open} className="group rounded-xl border border-line bg-surface px-3 py-2 open:bg-sunk/70">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <div className="line-clamp-2 text-[13px] leading-snug font-semibold group-open:line-clamp-none">{i.name}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <Badge tone={cost ? "neutral" : "warn"}>{cost ? (c.max === 0 ? "Free" : `${cost} ${c.currency ?? ""}`) : "No fee stated"}</Badge>
          {time && <Badge>{time} d</Badge>}
          {issues.length === 0 ? <Badge tone="ok" title="Page re-read live and Gemini agrees">✓ Checked</Badge>
            : <Badge tone={severe ? "bad" : "warn"} title={issues.map((x) => x.text).join("; ")}>⚑ {issues.length} to check</Badge>}
          <span className="ml-auto text-[11px] text-faint group-open:hidden">Read more</span>
        </div>
      </summary>
      <div className="mt-2 space-y-1.5 border-t border-dashed border-line pt-2 text-xs text-mut">
        {i.authority && <div><b className="font-medium text-ink">Issued by</b> {i.authority}</div>}
        {issues.length > 0 && <ul className="space-y-0.5 text-warn">{issues.map((x, n) => <li key={n}>⚑ {x.text}</li>)}</ul>}
        {i.gemini?.note && i.gemini.verdict !== "supported" && <div>Gemini: {i.gemini.note}</div>}
        {i.cost_corrected && <div className="text-accent">Fee corrected from {i.cost_unsupported?.min ?? i.cost_unsupported?.max} after checking the page.</div>}
        {i.renewal && <div>↻ {i.renewal}</div>}
        {i.ongoing_filing && <div>▤ {i.ongoing_filing}</div>}
        {i.evidence && <blockquote className="rounded-r-lg border-l-2 border-line2 bg-bg px-2.5 py-1.5">“{i.evidence}”</blockquote>}
        <div>{i.source_url && <a href={i.source_url} target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">Official source ↗</a>} <span className="text-faint">checked {i.checked_at}</span></div>
      </div>
    </details>
  );
}

/** A cell shows its most useful items first and keeps the rest one click away. */
function Cell({ items, detailed }: { items: any[]; detailed: boolean }) {
  const [all, setAll] = useState(false);
  const sorted = [...items].sort((a, b) => weight(b) - weight(a) || a.step - b.step);
  const shown = detailed || all ? sorted : sorted.slice(0, COMPACT), hidden = sorted.length - shown.length;
  if (!sorted.length) return <span className="text-faint">—</span>;
  return (
    <div className="space-y-2">
      {shown.map((i, n) => <Item key={`${i.name}-${n}-${detailed}`} i={i} open={detailed} />)}
      {!detailed && sorted.length > COMPACT && <button type="button" onClick={() => setAll(!all)} className="text-xs font-medium text-accent">{all ? "Show fewer" : `+${hidden} more`}</button>}
    </div>
  );
}

/** Long text lists (renewals, filings, gaps): two lines, then "+N more". */
function Lines({ items, empty }: { items: ReactNode[]; empty: ReactNode }) {
  const [all, setAll] = useState(false);
  if (!items.length) return <>{empty}</>;
  return (
    <div className="space-y-1.5 text-xs">
      {(all ? items : items.slice(0, 2)).map((x, n) => <div key={n}>{x}</div>)}
      {items.length > 2 && <button type="button" onClick={() => setAll(!all)} className="font-medium text-accent">{all ? "Show fewer" : `+${items.length - 2} more`}</button>}
    </div>
  );
}

/** The side-by-side table: key figures first (best value highlighted), then the same requirement kinds for every place. */
export default function Matrix({ data }: { data: Data }) {
  const P = data.places;
  const [kind, setKind] = useState("all");
  const [flagged, setFlagged] = useState(false);
  const [detailed, setDetailed] = useState(false);
  const winner = data.recommendation.ranking[0]?.place;
  const isFlag = (i: any) => issuesOf(i).length > 0;
  const kinds = KINDS.filter((k) => (kind === "all" || kind === k) && P.some((p) => p.items.some((i: any) => i.kind === k && (!flagged || isFlag(i)))));

  // highlight the best place in a row, but only when places actually differ and every place has the figure
  const best = (get: (p: any) => number | null, low: boolean) => {
    const v = P.map(get);
    if (v.some((x) => x == null) || new Set(v).size < 2) return v.map(() => false);
    const t = low ? Math.min(...(v as number[])) : Math.max(...(v as number[]));
    return v.map((x) => x === t);
  };
  const bestTime = best((p) => p.summary.time_max_days, true), bestSteps = best((p) => p.summary.steps, true), bestVer = best((p) => p.summary.confidence, false);

  const chip = (on: boolean) => cx("rounded-full border px-3 py-1 text-xs font-medium transition", on ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface text-ink hover:border-ink");
  const th = "sticky top-0 z-[3] border-b border-r border-line bg-sunk p-3 text-left align-top text-sm font-semibold last:border-r-0";
  const td = "border-b border-r border-line p-2.5 align-top last:border-r-0";
  const rowHead = "sticky left-0 z-[2] w-32 min-w-32 border-b border-r border-line bg-sunk p-3 text-left align-top text-sm font-semibold";
  const glance = (on: boolean) => cx(td, "text-sm", on && "bg-ok-soft/50");

  return (
    <section>
      <SectionTitle aside={
        <div className="flex flex-wrap items-center gap-1.5 print:hidden" role="group" aria-label="Table options">
          {["all", ...KINDS].map((k) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={chip(kind === k)}>{k === "all" ? "All" : KIND_LABEL[k]}</button>)}
          <span aria-hidden className="mx-1 h-4 w-px bg-line2" />
          <button type="button" aria-pressed={flagged} onClick={() => setFlagged(!flagged)} className={chip(flagged)}>⚑ Only flagged</button>
          <button type="button" aria-pressed={detailed} onClick={() => setDetailed(!detailed)} className={chip(detailed)}>Show all details</button>
        </div>}>Requirements, side by side</SectionTitle>

      <div className="max-h-[80vh] overflow-auto rounded-2xl border border-line bg-surface print:max-h-none">
        <table className="w-full table-fixed border-separate border-spacing-0 text-[13.5px]" style={{ minWidth: 128 + P.length * 235 }}>
          <colgroup><col style={{ width: 128 }} />{P.map((p) => <col key={p.place} />)}</colgroup>
          <thead><tr>
            <th scope="col" className={cx(th, "left-0 z-[4]")} />
            {P.map((p) => <th scope="col" key={p.place} className={th}>
              <div className="flex flex-wrap items-center gap-1.5">{p.place}{p.place === winner && <Badge tone="accent">★ Pick</Badge>}</div>
              <div className="mt-1"><Badge tone={LEVEL[p.level]?.tone}>{LEVEL[p.level]?.label}</Badge></div>
            </th>)}
          </tr></thead>
          <tbody>
            {/* at a glance */}
            <tr><th scope="row" className={rowHead}>Fees stated</th>{P.map((p) => { const s = p.summary, cost = range(s.cost_min, s.cost_max), un = s.cost_items_unknown;
              return <td key={p.place} className={glance(false)}><div className="font-semibold tabular-nums">{!cost ? "None stated" : s.cost_max === 0 ? "Free where stated" : s.currency === "MIXED" ? "Mixed currencies" : `${cost} ${s.currency ?? ""}`}</div>
                {s.usd_max != null && s.cost_max > 0 && <div className="text-xs text-mut">≈ {s.usd_min === s.usd_max ? usd(s.usd_max) : `${usd(s.usd_min)}–${usd(s.usd_max)}`} USD</div>}
                <div className={cx("text-xs", un ? "font-medium text-warn" : "text-ok")}>{un ? `${s.steps - un} of ${s.steps} steps priced` : "every step priced"}</div></td>; })}</tr>
            <tr><th scope="row" className={rowHead}>Time to approval</th>{P.map((p, n) => <td key={p.place} className={glance(bestTime[n])}><div className="font-semibold tabular-nums">{p.summary.time_max_days != null ? `${p.summary.time_max_days} d` : "Not stated"}</div>{p.summary.time_longest_step_days != null && <div className="text-xs text-mut">longest step {p.summary.time_longest_step_days} d</div>}</td>)}</tr>
            <tr><th scope="row" className={rowHead}>Start-up steps</th>{P.map((p, n) => <td key={p.place} className={glance(bestSteps[n])}><div className="font-semibold tabular-nums">{p.summary.steps ?? "—"}</div><div className="text-xs text-mut">{p.summary.renewals.length} renewals · {p.summary.ongoing_filings.length} filings</div></td>)}</tr>
            <tr><th scope="row" className={rowHead}>Sources verified</th>{P.map((p, n) => <td key={p.place} className={glance(bestVer[n])}><div className="font-semibold tabular-nums">{Math.round(p.summary.confidence * 100)}%</div><div className="text-xs text-mut">{p.summary.verified}/{p.items.length} live · {p.summary.gaps} gaps</div></td>)}</tr>

            {/* requirements by kind */}
            {kinds.map((k) => (
              <tr key={k}>
                <th scope="row" className={rowHead}><span className="inline-block rounded-full px-2.5 py-1 text-xs" style={{ background: `var(--k-${k})` }}>{KIND_LABEL[k]}</span></th>
                {P.map((p) => <td key={p.place} className={td}><Cell items={p.items.filter((i: any) => i.kind === k && (!flagged || isFlag(i)))} detailed={detailed} /></td>)}
              </tr>
            ))}
            {kinds.length === 0 && <tr><td colSpan={P.length + 1} className="p-6 text-center text-mut">Nothing matches this filter.</td></tr>}

            <tr><th scope="row" className={rowHead}>Renewals</th>{P.map((p) => <td key={p.place} className={td}><Lines empty={<Badge tone="warn">None stated</Badge>}
              items={p.summary.renewals.map((x: any) => <><b className="font-medium">{x.name}</b><br /><span className="text-mut">↻ {x.renewal} <a href={x.source_url} target="_blank" rel="noopener noreferrer" className="text-accent">↗</a></span></>)} /></td>)}</tr>
            <tr><th scope="row" className={rowHead}>Recurring filings</th>{P.map((p) => <td key={p.place} className={td}><Lines empty={<Badge tone="warn">None stated</Badge>}
              items={p.summary.ongoing_filings.map((x: any) => <><b className="font-medium">{x.name}</b><br /><span className="text-mut">▤ {x.filing} <a href={x.source_url} target="_blank" rel="noopener noreferrer" className="text-accent">↗</a></span></>)} /></td>)}</tr>
            <tr><th scope="row" className={rowHead}>Gaps &amp; unclear</th>{P.map((p) => <td key={p.place} className={td}><Lines empty={<span className="text-faint">None reported</span>}
              items={p.gaps.map((g: string) => <span className="text-warn">• {g}</span>)} /></td>)}</tr>
            <tr><th scope="row" className={cx(rowHead, "border-b-0")}>Research run</th>{P.map((p) => <td key={p.place} className={cx(td, "border-b-0 text-xs text-faint")}>{p.research_run_id ?? "—"}<br />{p.termination_reason ?? ""}</td>)}</tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

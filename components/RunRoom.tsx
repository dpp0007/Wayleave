"use client";
import { useEffect, useState } from "react";
import { STEPS, clock, minutesLeft, overallProgress, placeProgress, stepOf } from "@/lib/progress";
import { LEVEL, type Job, type PlaceState } from "@/lib/types";
import { Badge, Card, Eyebrow, Skeleton, Spinner, button, cx } from "./ui";

// Short, true statements about the method. They rotate while the long step runs, so the wait teaches something.
const TIPS = [
  "Deep research works in rounds: it plans questions, searches, reads the pages, then plans again around what is still missing.",
  "Every fee is matched to the official page it came from, and that page is re-opened live to check the quote is really there.",
  "A number that appears on a page only as “36 months” or “20%” is not counted as a fee.",
  "An unstated fee is never treated as free or cheap. It is flagged as a gap and kept out of the score.",
  "Gemini re-reads each figure against the page text and checks the currency, because a bare “$” can mean SGD or USD.",
  "Exchange rates are cross-checked across three independent live sources before any USD figure is shown.",
  "This is a starting point to hand to a lawyer, not legal advice.",
];

/** Re-renders every `ms` with an index in 0..n-1, so rotating text needs no animation library. */
function useRotate(n: number, ms: number) {
  const [i, setI] = useState(0);
  useEffect(() => { if (n < 2) return; const t = setInterval(() => setI((x) => (x + 1) % n), ms); return () => clearInterval(t); }, [n, ms]);
  return n ? i % n : 0;
}

function statusLabel(p: PlaceState) {
  const s = stepOf(p);
  if (s >= STEPS.length) return p.report?.level === "failed" ? "Not assessed" : "Done";
  if (s === 4) return "Gemini is double-checking figures";
  if (s === 2) return p.activity?.sourceCount ? "Reading official sources" : "Deep research starting";
  return s === 1 ? "First look at one official page" : "Finding official pages";
}

function PlaceRoom({ p, now }: { p: PlaceState; now: number }) {
  const a = p.activity;
  const q = useRotate(a?.questions.length ?? 0, 6000);
  const pct = Math.round(placeProgress(p, now) * 100);
  const finished = stepOf(p) >= STEPS.length;
  const preview = !p.done && p.report?.items?.length ? p.report.items : null;
  const level = p.report?.level && LEVEL[p.report.level];

  return (
    <div className="animate-rise rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg">{p.place}</h3>
        {finished ? <Badge tone={level?.tone ?? "ok"}>{level?.label ?? "Done"}</Badge> : <span className="inline-flex items-center gap-1.5 text-xs font-medium text-accent"><Spinner />{pct}%</span>}
      </div>
      <p className="mt-0.5 text-sm text-mut">{statusLabel(p)}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sunk" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.place} progress`}>
        <div className={cx("h-full rounded-full transition-[width] duration-700", finished ? "bg-ok" : "bg-gradient-to-r from-accent to-warm")} style={{ width: `${finished ? 100 : pct}%` }} />
      </div>

      {!p.done && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[["Pages read", a?.sourceCount], ["Facts found", a?.claims], ["Round", a?.round]].map(([l, v]) => (
            <div key={l as string} className="rounded-lg bg-sunk py-2">
              <div className="text-lg font-semibold tabular-nums">{v ?? "–"}</div>
              <div className="text-[11px] text-mut">{l}</div>
            </div>
          ))}
        </div>
      )}

      {!p.done && p.stage >= 2 && (
        <div className="mt-4 min-h-[3.2rem]">
          <Eyebrow>Looking into</Eyebrow>
          {a?.questions.length ? <p key={q} className="mt-1 animate-rise text-sm leading-snug italic text-ink">“{a.questions[q]}”</p>
            : a?.summary ? <p className="mt-1 text-sm leading-snug italic text-ink">{a.summary}</p>
            : <div className="mt-2 space-y-1.5"><Skeleton className="h-3 w-5/6" /><Skeleton className="h-3 w-2/3" /></div>}
        </div>
      )}

      {!p.done && p.stage >= 2 && (
        <div className="mt-3">
          <Eyebrow>Latest pages</Eyebrow>
          {a?.sources.length ? (
            <ul className="mt-1.5 space-y-1.5">
              {a.sources.slice(0, 4).map((s) => (
                <li key={s.domain + s.title} className="flex animate-rise items-baseline justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate"><b className="font-semibold">{s.domain}</b> <span className="text-mut">{s.title}</span></span>
                  {s.claims > 0 && <span className="shrink-0 text-[11px] font-medium text-ok">+{s.claims} facts</span>}
                </li>
              ))}
            </ul>
          ) : <div className="mt-2 space-y-1.5"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-4/5" /></div>}
        </div>
      )}

      {p.done && p.report?.items?.length > 0 && (
        <p className="mt-4 rounded-lg bg-sunk px-3 py-2 text-sm text-mut">
          <b className="font-semibold text-ink">{p.report.items.length} requirements found.</b>{" "}
          {finished ? "Fees, currencies and sources are checked." : "Every cited page was re-read live; Gemini is now checking fees and currencies."}
        </p>
      )}

      {preview && (
        <details className="mt-3 rounded-lg border border-line bg-sunk/60 px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium text-accent">First look: {preview.length} findings so far</summary>
          <ul className="mt-2 space-y-1 text-mut">{preview.slice(0, 6).map((i: any, n: number) => <li key={n}>· {i.name}</li>)}</ul>
          <p className="mt-2 text-xs text-faint">From one official page only. Deep research will replace this.</p>
        </details>
      )}
    </div>
  );
}

export default function RunRoom({ job, now, onNotify }: { job: Job; now: number; onNotify: () => Promise<boolean> }) {
  const elapsed = now - job.startedAt;
  const progress = overallProgress(job.places, now);
  const left = minutesLeft(progress, elapsed);
  const tip = useRotate(TIPS.length, 7500);
  const [notify, setNotify] = useState<"idle" | "on" | "blocked">("idle");
  const active = job.places.map(stepOf);

  return (
    <Card className="animate-rise">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <Eyebrow>Research in progress</Eyebrow>
          <h2 className="mt-1 text-2xl">Reading the official rules for {job.places.length} places</h2>
          <p className="mt-1 text-sm text-mut">This takes about 4–8 minutes because deep research reads dozens of pages. Keep this tab open in the background; the tab title shows progress.</p>
        </div>
        <div className="text-right">
          <div className="font-serif text-4xl tabular-nums" aria-label="Elapsed time">{clock(elapsed)}</div>
          <div className="text-xs text-mut">{left ? `about ${left} min left` : "usually 4–8 min"}</div>
        </div>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-sunk" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Overall progress">
        <div className="h-full rounded-full bg-gradient-to-r from-accent to-warm transition-[width] duration-700" style={{ width: `${Math.max(3, Math.round(progress * 100))}%` }} />
      </div>
      <ol className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
        {STEPS.map((s, i) => {
          const all = active.every((a) => a > i), some = active.some((a) => a === i);
          return <li key={s} className={cx("flex items-center gap-1.5", all ? "text-ok" : some ? "font-semibold text-accent" : "text-faint")}>
            <span aria-hidden className={cx("size-1.5 rounded-full", all ? "bg-ok" : some ? "animate-pulse bg-accent" : "bg-line2")} />{s}</li>;
        })}
      </ol>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{job.places.map((p) => <PlaceRoom key={p.place} p={p} now={now} />)}</div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-accent-soft px-4 py-3">
        <p key={tip} className="animate-rise text-sm text-ink"><b className="font-semibold text-accent">How it works · </b>{TIPS[tip]}</p>
        <button type="button" className={cx(button.ghost, "h-9 shrink-0 text-xs")} disabled={notify !== "idle"}
          onClick={async () => setNotify((await onNotify()) ? "on" : "blocked")}>
          {notify === "on" ? "✓ We'll notify you" : notify === "blocked" ? "Notifications blocked" : "Notify me when ready"}
        </button>
      </div>
    </Card>
  );
}

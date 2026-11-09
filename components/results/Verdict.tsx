import type { Recommendation } from "@/lib/types";
import { Badge, Card, Eyebrow, cx } from "../ui";

/** The answer first: who wins, why in two or three lines, and what to keep in mind. Scores sit beside it, never in place of it. */
export default function Verdict({ r }: { r: Recommendation }) {
  const top = r.ranking[0];
  const good = r.points.filter((p) => p.tone === "good");
  const caveats = r.points.filter((p) => p.tone !== "good" && !p.text.startsWith("Costs/times"));
  return (
    <Card className="grid animate-rise gap-8 md:grid-cols-[1.4fr_1fr]">
      <div>
        <div className="flex items-center gap-2">
          <Badge tone={!top ? "warn" : r.provisional ? "warn" : "accent"}>{!top ? "Not enough data" : r.provisional ? "Provisional pick" : "Recommended"}</Badge>
          <Eyebrow>Easiest place to start</Eyebrow>
        </div>
        <h2 className="mt-2 text-4xl leading-tight">{top ? r.headline : "Not enough data to recommend"}</h2>
        {good.length > 0 && (
          <ul className="mt-4 space-y-2">
            {good.map((p, i) => <li key={i} className="flex gap-2.5 text-sm"><span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ok-soft text-[11px] font-bold text-ok">✓</span>{p.text}</li>)}
          </ul>
        )}
        {caveats.length > 0 && (
          <details className="group mt-4 rounded-xl border border-line bg-sunk/60 px-4 py-3 text-sm" open={!top}>
            <summary className="cursor-pointer font-medium text-mut group-open:text-ink">{caveats.length} thing{caveats.length > 1 ? "s" : ""} to keep in mind</summary>
            <ul className="mt-3 space-y-2">
              {caveats.map((p, i) => <li key={i} className="flex gap-2.5"><span aria-hidden className={cx("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold", p.tone === "bad" ? "bg-bad-soft text-bad" : "bg-warn-soft text-warn")}>!</span>{p.text}</li>)}
            </ul>
          </details>
        )}
      </div>

      <div aria-label="Score ranking" className="content-start space-y-3">
        <Eyebrow>Score · higher is easier</Eyebrow>
        {r.ranking.map((x, n) => (
          <div key={x.place}>
            <div className="flex justify-between text-sm"><span>{x.place}</span><b className="tabular-nums">{Math.round(x.score * 100)}</b></div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-sunk"><div className={cx("h-full rounded-full transition-[width] duration-700", n === 0 ? "bg-gradient-to-r from-accent to-warm" : "bg-line2")} style={{ width: `${Math.max(4, x.score * 100)}%` }} /></div>
          </div>
        ))}
        <p className="text-xs text-faint">Cost 35% · time 30% · steps 15% · verified sources 20%. A fee or time that isn’t stated is never scored as “cheap” or “fast”.</p>
      </div>
    </Card>
  );
}

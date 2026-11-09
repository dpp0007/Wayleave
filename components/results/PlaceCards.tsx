import { LEVEL } from "@/lib/types";
import { Badge, Card, Skeleton, cx } from "../ui";

const num = (n: any) => (typeof n === "number" ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : n);
const range = (a: any, b: any) => (a == null && b == null ? null : a === b || b == null ? num(a) : a == null ? num(b) : `${num(a)}–${num(b)}`);
/** Small amounts keep their decimals ("0.4"), large ones are compacted ("12k"). */
export const usd = (n: number | null | undefined) => (n == null ? "" : n < 10 ? String(Math.round(n * 100) / 100) : n >= 10000 ? `${Math.round(n / 1000)}k` : Math.round(n).toLocaleString("en-US"));

function Stat({ label, value, sub, children }: { label: string; value: string; sub?: string; children?: React.ReactNode }) {
  return <div><div className="text-[11.5px] text-mut">{label}</div><div className="text-xl font-semibold tracking-tight tabular-nums">{value}</div>{sub && <div className="text-xs text-mut">{sub}</div>}{children}</div>;
}

/** One scorecard per place. Places still being researched show a quiet skeleton so the layout does not jump when they arrive. */
export default function PlaceCards({ places, winner, pending }: { places: any[]; winner?: string; pending: string[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {places.map((p) => {
        const s = p.summary, lv = LEVEL[p.level] ?? { label: "", tone: "ok" as const };
        const cost = range(s.cost_min, s.cost_max);
        const steps = s.steps ?? 0, unpriced = s.cost_items_unknown, priced = Math.max(0, steps - unpriced);
        const pct = Math.round(s.confidence * 100);
        const free = cost && s.cost_max === 0;
        return (
          <Card key={p.place} className={cx("animate-rise p-4", p.place === winner && "border-accent ring-2 ring-accent-soft")}>
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg">{p.place}</h3>
              <div className="flex flex-wrap justify-end gap-1">{p.place === winner && <Badge tone="accent">★ Pick</Badge>}<Badge tone={lv.tone}>{lv.label}</Badge></div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4">
              <Stat label="Fees stated by officials" value={!cost ? "None stated" : free ? "Free where stated" : s.currency === "MIXED" ? "Mixed currencies" : `${cost} ${s.currency ?? ""}`}
                sub={s.usd_max != null && !free ? `≈ ${s.usd_min === s.usd_max ? usd(s.usd_max) : `${usd(s.usd_min)}–${usd(s.usd_max)}`} USD` : undefined}>
                <div className={cx("mt-0.5 text-xs", unpriced ? "font-medium text-warn" : "text-ok")}>{unpriced ? `${priced} of ${steps} steps priced: a floor, not a total` : "every step priced"}</div>
              </Stat>
              <Stat label="Time to approval" value={s.time_max_days != null ? `${s.time_max_days} d` : "—"}
                sub={s.time_longest_step_days != null ? `longest step ${s.time_longest_step_days} d` : "not stated"} />
              <Stat label="Start-up steps" value={String(s.steps ?? "—")} sub={`${s.renewals.length} renewals · ${s.ongoing_filings.length} filings`} />
              <div>
                <div className="text-[11.5px] text-mut">Sources verified</div>
                <div className="flex items-center gap-2">
                  <div className="grid size-11 place-items-center rounded-full" style={{ background: `conic-gradient(var(--ok) ${pct}%, var(--line) 0)` }}>
                    <div className="grid size-8 place-items-center rounded-full bg-surface text-[11px] font-semibold">{pct}%</div>
                  </div>
                  <div className="text-xs text-mut">{s.verified}/{p.items.length} live<br />{s.gaps} gaps</div>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
      {pending.map((name) => (
        <Card key={name} className="p-4">
          <h3 className="text-lg text-mut">{name}</h3>
          <div className="mt-4 grid grid-cols-2 gap-4"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
          <p className="mt-3 text-xs text-faint">Still researching…</p>
        </Card>
      ))}
    </div>
  );
}

import type { Data } from "./types";

const money = (a: any, b: any, cur?: string) => (a == null && b == null ? "not stated" : `${a === b || b == null ? a : a == null ? b : `${a}-${b}`} ${cur ?? ""}`.trim());

/** The whole comparison as Markdown: something a founder can paste into an email or hand to a lawyer. Every row keeps its source link. */
export function toMarkdown(data: Data, activity: string, checkedOn = new Date().toISOString().slice(0, 10)): string {
  const r = data.recommendation, L: string[] = [];
  L.push(`# ${activity}`, `Compared on ${checkedOn}. Source: official government pages, each re-read live. Informational only, not legal advice.`, "");
  L.push(`## Recommendation`, `**${r.provisional ? "Provisional: " : ""}${r.headline}**`, "", ...r.points.filter((p) => !p.text.startsWith("Costs/times")).map((p) => `- ${p.text}`), "");
  L.push(`## Side by side`, `| Place | Start-up cost | Time to approval | Steps | Sources verified |`, `|---|---|---|---|---|`);
  for (const p of data.places) {
    const s = p.summary;
    L.push(`| ${p.place} | ${money(s.cost_min, s.cost_max, s.currency)}${s.usd_max != null ? ` (about ${s.usd_min}-${s.usd_max} USD)` : ""} | ${s.time_max_days != null ? `up to ${s.time_max_days} days` : "not stated"} | ${s.steps ?? "n/a"} | ${s.verified}/${p.items.length} |`);
  }
  for (const p of data.places) {
    L.push("", `## ${p.place}`);
    for (const i of p.items) {
      L.push(`- **${i.name}** (${i.kind}). Fee: ${money(i.cost?.min, i.cost?.max, i.cost?.currency)}. Time: ${i.time_days?.min == null && i.time_days?.max == null ? "not stated" : `${i.time_days.min ?? ""}-${i.time_days.max ?? ""} days`}.${i.renewal ? ` Renewal: ${i.renewal}.` : ""} [Source](${i.source_url}), checked ${i.checked_at}.`);
    }
    if (p.gaps?.length) L.push("", "Gaps and unclear rules:", ...p.gaps.map((g: string) => `- ${g}`));
  }
  if (data.fx.rows.length) L.push("", "## Currency", ...data.fx.rows.map((x) => `- 1 USD = ${x.per_usd} ${x.currency} (${x.sources.length} live sources, ${x.status === "ok" ? "agree" : x.status === "diverge" ? "DISAGREE" : "single source"}). Indicative only.`));
  return L.join("\n");
}

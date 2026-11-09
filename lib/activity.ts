// Turns the working state TinyFish keeps for a running research run into a compact live feed for the waiting screen.
// While a run is RUNNING, GET /v1/research-run/{id} already returns the current plan, the sources read so far and the claims found in them.
export type Activity = {
  round: number;
  summary?: string;                                        // what the researcher is doing this round
  questions: string[];                                     // sub-questions being investigated
  sources: { domain: string; title: string; claims: number }[]; // most recent first
  sourceCount: number;
  claims: number;
};

const host = (u?: string) => { try { return new URL(u || "").hostname.replace(/^www\./, ""); } catch { return ""; } };

export function activityOf(run: any): Activity | null {
  if (!run) return null;
  const ev: any[] = Array.isArray(run.evidence) ? run.evidence : [];
  const questions = (run.research_plan?.subquestions ?? []).map((q: any) => String(q?.question ?? "")).filter(Boolean).slice(0, 4);
  if (!ev.length && !questions.length && !run.research_plan?.summary) return null;
  return {
    round: Number(run.iterations) || 0,
    summary: run.research_plan?.summary ? String(run.research_plan.summary).slice(0, 240) : undefined,
    questions: questions.map((q: string) => q.slice(0, 150)),
    sources: ev.slice(-6).reverse().map((e) => ({ domain: host(e.url), title: String(e.title ?? "").slice(0, 80), claims: Array.isArray(e.claims) ? e.claims.length : 0 })).filter((s) => s.domain),
    sourceCount: ev.length,
    claims: ev.reduce((n, e) => n + (Array.isArray(e.claims) ? e.claims.length : 0), 0),
  };
}

import { NextResponse } from "next/server";
import { activityOf } from "@/lib/activity";
import { api } from "@/lib/api";
import { fail, noStore } from "@/lib/guard";
import { type Level, normalizeItems, parseJson, verifyItems } from "@/lib/logic";
import { agentGet, researchCancel, researchGet } from "@/lib/tf";
import { parsePoll } from "@/lib/validate";

export const maxDuration = 60;
const DEADLINE = (Number(process.env.RESEARCH_DEADLINE_MIN) || 8) * 60_000;
const TERMINAL = ["COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"];
const json = (o: object) => NextResponse.json(o, { headers: noStore });

const parseResearch = (run: any) => {
  const deep = run?.deep_result || {};
  const d = parseJson(deep.result);
  return { items: normalizeItems(d?.items), gaps: ((d?.gaps as string[]) ?? []).filter((g) => typeof g === "string").slice(0, 40), deep };
};

/**
 * Graceful degradation ladder, per place (stateless: the client passes ids + startedAt, validated by parsePoll):
 *   full    deep research COMPLETED and parsed
 *   partial deep research hit our deadline -> cancel, keep whatever report it saved
 *   quick   single-official-page Agent read (~1-2 min); shown early as a preview while research continues
 *   failed  nothing usable -> place flagged "not assessed" and excluded from the ranking
 * Pending answers carry `stage` (0 search, 1 quick read, 2 deep research) and a live `activity` feed for the waiting screen.
 */
export const POST = api("poll", async (body) => {
  const s = parsePoll(body);
  if (!s) return fail(400, "Invalid request.");
  const { place, researchId, agentId, startedAt, previewSent, notes } = s;
  const late = Date.now() - startedAt > DEADLINE;
  const base = { place, research_run_id: researchId, notes };

  const final = async (level: Level, items: any[], gaps: string[], extra: any = {}) =>
    json({ state: "final", report: { ...base, level, status: extra.status ?? "n/a", termination_reason: extra.deep?.termination_reason,
      freshness: extra.deep?.freshness_report, all_citations: (extra.deep?.citations ?? []).slice(0, 80), items: await verifyItems(items), gaps } });

  let run: any = null;
  if (researchId) { try { run = await researchGet(researchId); } catch { notes.push("Research status check failed; retrying."); } }
  const terminal = !!run && TERMINAL.includes(run.status);

  if (run?.status === "COMPLETED") {
    const p = parseResearch(run);
    if (p.items.length) return final("full", p.items, p.gaps, { deep: p.deep, status: run.status });
    notes.push("Research finished but its report could not be parsed into requirements.");
  } else if (run && !terminal && late) {
    await researchCancel(researchId!);
    try { run = await researchGet(researchId!); } catch { /* keep last known */ }
    const p = parseResearch(run);
    if (p.items.length) return final("partial", p.items, [...p.gaps, `Deep research hit the ${DEADLINE / 60000}-minute deadline; this is a partial report.`], { deep: p.deep, status: run.status });
    notes.push(`Deep research hit the ${DEADLINE / 60000}-minute deadline with no usable partial report.`);
  } else if (terminal) {
    notes.push(`Deep research ended ${run.status}.`);
  }
  // A failed status read (run === null) means "unknown", not "finished": keep waiting. Finalising from the quick read here once
  // crowned a 2-item place the winner while its deep research had actually completed.
  const researchPending = (!!run && !terminal && !late) || (!!researchId && !run && !late);
  const activity = researchPending ? activityOf(run) : null;

  let agent: any = null;
  if (agentId) { try { agent = await agentGet(agentId); } catch { notes.push("Quick-read status check failed."); } }
  const res = agent?.status === "COMPLETED" ? agent.result : null;
  const d = typeof res === "string" ? parseJson(res) : res;
  const qItems = normalizeItems(d?.items);

  if (qItems.length) {
    const gaps = [...((d.gaps ?? []) as string[]).filter((g) => typeof g === "string").slice(0, 20), "Quick read: covers ONE official page only, so requirements elsewhere may be missing."];
    if (researchPending) {
      if (previewSent) return json({ state: "pending", stage: 2, activity });
      return json({ state: "pending", stage: 2, activity,
        preview: { ...base, level: "quick" as Level, status: "preview", items: await verifyItems(qItems), gaps, all_citations: [] } });
    }
    return final("quick", qItems, gaps, { status: "quick" });
  }

  const agentPending = agent && ["PENDING", "QUEUED", "RUNNING"].includes(agent.status) && !late;
  if (researchPending || agentPending) return json({ state: "pending", stage: researchPending ? 2 : 1, activity });
  notes.push("No usable requirements could be retrieved for this place.");
  return final("failed", [], ["NOT ASSESSED: research and quick read both failed or timed out. Do not treat this as 'no requirements'."]);
}, { maxBytes: 20_000 });

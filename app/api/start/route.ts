import { api } from "@/lib/api";
import { chargeRuns, fail } from "@/lib/guard";
import { agentGoal, isOfficial, researchQuery } from "@/lib/logic";
import { TFError, agentStart, explain, researchStart, search } from "@/lib/tf";
import { parseStart } from "@/lib/validate";

export const maxDuration = 60;
const prefer = (u: string) => (/licen|permit|regist|start|business|apply/i.test(u) ? 0 : 1);

// Starts everything for one place; each step degrades independently so one failure never blocks the rest.
async function startPlace(activity: string, place: string) {
  const notes: string[] = [];
  let seeds: string[] = [];
  try {
    const hits = [...(await search(`${activity} licence permit registration requirements fees ${place} official government`)),
                  ...(await search(`${activity} ${place} site:gov`).catch(() => []))];
    seeds = [...new Set<string>(hits.map((h: any) => h.url).filter(isOfficial))].sort((a, b) => prefer(a) - prefer(b));
  } catch (e) { notes.push(`Search failed: ${explain(e)}. Researching without seed pages.`); }

  const [research, agent] = await Promise.allSettled([
    researchStart(researchQuery(activity, place, seeds), [...new Set(seeds.map((u) => new URL(u).hostname))]),
    seeds[0] ? agentStart(seeds[0], agentGoal(activity, place)) : Promise.reject(new Error("no official seed page")),
  ]);
  if (research.status === "rejected") notes.push(`Deep research unavailable: ${explain(research.reason)}.`);
  if (agent.status === "rejected") notes.push(`Quick read skipped (${(agent.reason as Error).message}).`);
  const fatal = research.status === "rejected" && agent.status === "rejected" ? (research.reason as TFError).code : undefined;
  return {
    place, seeds, notes, startedAt: Date.now(), fatal,
    researchId: research.status === "fulfilled" ? research.value : null,
    agentId: agent.status === "fulfilled" ? agent.value : null,
  };
}

export const POST = api("start", async (body) => {
  const v = parseStart(body);
  if ("error" in v) return fail(400, v.error);
  if (!process.env.TINYFISH_API_KEY) return fail(503, "The research service is not configured yet.");
  if (!chargeRuns(v.places.length)) return fail(429, "Today's research budget is used up. Please try again tomorrow.");
  const started = await Promise.all(v.places.map((p) => startPlace(v.activity, p)));
  // Nothing could be started anywhere for an account-level reason: say so now instead of starting a job that can only fail.
  const code = started[0].fatal;
  if (code && started.every((p) => p.fatal === code) && ["INVALID_API_KEY", "INSUFFICIENT_CREDITS"].includes(code))
    return fail(code === "INVALID_API_KEY" ? 503 : 402, `Could not start: ${explain(new TFError(0, code, ""))}.`);
  return { places: started.map(({ fatal, ...p }) => p) };
}, { maxBytes: 4_000 });

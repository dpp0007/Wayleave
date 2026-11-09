import { NextResponse } from "next/server";
import { agentGoal, isOfficial, researchQuery } from "@/lib/logic";
import { TFError, agentStart, explain, researchStart, search } from "@/lib/tf";

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

export async function POST(req: Request) {
  const { activity, places } = await req.json().catch(() => ({}));
  const list: string[] = Array.isArray(places) ? [...new Set<string>(places.map((p: string) => String(p).trim()).filter(Boolean))] : [];
  if (!activity?.trim() || list.length < 3) return NextResponse.json({ error: "Need an activity and at least 3 places." }, { status: 400 });
  if (list.length > 5) return NextResponse.json({ error: "At most 5 places (TinyFish allows 5 concurrent research runs)." }, { status: 400 });
  if (!process.env.TINYFISH_API_KEY) return NextResponse.json({ error: "TINYFISH_API_KEY is not set on the server." }, { status: 500 });
  const started = await Promise.all(list.map((p) => startPlace(activity.trim(), p)));
  // Nothing could be started anywhere for an account-level reason: say so now instead of starting a job that can only fail.
  const code = started[0].fatal;
  if (code && started.every((p) => p.fatal === code) && ["INVALID_API_KEY", "INSUFFICIENT_CREDITS"].includes(code))
    return NextResponse.json({ error: `Could not start: ${explain(new TFError(0, code, ""))}.` }, { status: code === "INVALID_API_KEY" ? 401 : 402 });
  return NextResponse.json({ places: started.map(({ fatal, ...p }) => p) });
}

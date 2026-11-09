// Input validation for everything that crosses the network boundary. Pure and dependency-free so it can be tested offline.
import { MAX_PLACES, MIN_PLACES } from "./types";

const CONTROL = new RegExp("[\\u0000-\\u001f\\u007f\\u2028\\u2029]", "g");
const MARKUP = /[<>{}`\\]/;

/** Trimmed single-line text within [min, max] characters, or null. Control characters and runs of whitespace are collapsed. */
export function cleanText(v: unknown, min: number, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(CONTROL, " ").replace(/\s+/g, " ").trim();
  return s.length >= min && s.length <= max ? s : null;
}


/** Validates a "start a comparison" request. The activity and places end up inside research prompts, so they are plain text only. */
export function parseStart(body: any): { activity: string; places: string[] } | { error: string } {
  const activity = cleanText(body?.activity, 3, 160);
  if (!activity) return { error: "Describe the activity in 3 to 160 characters." };
  if (!Array.isArray(body?.places)) return { error: `Choose ${MIN_PLACES} to ${MAX_PLACES} places.` };
  const seen = new Set<string>(), places: string[] = [];
  for (const raw of body.places.slice(0, 20)) {
    const p = cleanText(raw, 2, 80);
    if (!p) return { error: "Each place must be 2 to 80 characters." };
    if (!seen.has(p.toLowerCase())) { seen.add(p.toLowerCase()); places.push(p); }
  }
  if (places.length < MIN_PLACES || places.length > MAX_PLACES) return { error: `Choose ${MIN_PLACES} to ${MAX_PLACES} different places.` };
  if (MARKUP.test(activity) || places.some((p) => MARKUP.test(p))) return { error: "Please use plain text only." };
  return { activity, places };
}

/** A TinyFish run id: letters, digits and dashes only. Anything else is never forwarded upstream. */
export const isRunId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9-]{8,64}$/.test(v);

/** Only http(s) links are ever rendered or fetched; `javascript:` and friends from model or page output are dropped. */
export function safeUrl(u: unknown): string | undefined {
  if (typeof u !== "string" || u.length > 800) return undefined;
  try { const x = new URL(u); return x.protocol === "http:" || x.protocol === "https:" ? u : undefined; } catch { return undefined; }
}

/** Validates the state a poll carries (the server is stateless, so the browser sends it back). Returns null if it is not well formed. */
export function parsePoll(b: any) {
  const place = cleanText(b?.place, 2, 80);
  const researchId = b?.researchId == null ? null : isRunId(b.researchId) ? b.researchId : undefined;
  const agentId = b?.agentId == null ? null : isRunId(b.agentId) ? b.agentId : undefined;
  if (!place || researchId === undefined || agentId === undefined) return null;
  const now = Date.now(), t = Number(b?.startedAt);
  const startedAt = Number.isFinite(t) ? Math.min(now, Math.max(now - 3 * 3600_000, t)) : now; // a future or ancient start cannot dodge the deadline
  const notes = (Array.isArray(b?.notes) ? b.notes : []).slice(0, 12).map((n: unknown) => cleanText(n, 1, 400)).filter(Boolean) as string[];
  return { place, researchId, agentId, startedAt, previewSent: !!b?.previewSent, notes };
}

/** Caps for payloads the server re-processes (verify, fill, summarize) so they cannot be used to burn compute or tokens. */
export const MAX_ITEMS = 20;
export function itemsOf(v: unknown): any[] | null {
  if (!Array.isArray(v) || v.length > MAX_ITEMS) return null;
  return v.filter((i) => i && typeof i === "object" && !Array.isArray(i)).map((i) => ({ ...i, source_url: safeUrl(i.source_url) }));
}

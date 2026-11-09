import { api } from "@/lib/api";
import { geminiVerify } from "@/lib/gemini";
import { fail } from "@/lib/guard";
import { applyGemini } from "@/lib/logic";
import { cleanText, itemsOf } from "@/lib/validate";

export const maxDuration = 60;

// Second opinion on one place's figures. Failure is never fatal: the items come back unchanged with the reason, and the UI says
// "not double-checked" instead of implying a check happened.
export const POST = api("verify", async (b) => {
  const place = cleanText(b?.place, 2, 80), items = itemsOf(b?.items);
  if (!place || !items) return fail(400, "Invalid request.");
  const targets = items.map((it, i) => ({ it, i })).filter(({ it }) => it.evidence || it.excerpt);
  const res = await geminiVerify(place, targets.map(({ it, i }) => ({ i, name: it.name, cost: it.cost, time_days: it.time_days, evidence: it.evidence, excerpt: it.excerpt })));
  if (!res.ok) return { items, status: "unavailable", reason: "the double-check service did not answer" };
  return { items: applyGemini(items, res.byIndex ?? {}), status: "done", model: res.model };
}, { maxBytes: 400_000 });

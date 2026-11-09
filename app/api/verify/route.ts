import { NextResponse } from "next/server";
import { geminiVerify } from "@/lib/gemini";
import { applyGemini } from "@/lib/logic";

export const maxDuration = 60;

// Second opinion on one place's figures. Failure is never fatal: the items come back unchanged with the reason, and the UI says
// "not double-checked" instead of implying a check happened.
export async function POST(req: Request) {
  const { place, items } = await req.json().catch(() => ({}));
  if (!Array.isArray(items)) return NextResponse.json({ error: "items required" }, { status: 400 });
  const targets = items.map((it: any, i: number) => ({ it, i })).filter(({ it }) => it.evidence || it.excerpt);
  const res = await geminiVerify(String(place ?? ""), targets.map(({ it, i }) => ({ i, name: it.name, cost: it.cost, time_days: it.time_days, evidence: it.evidence, excerpt: it.excerpt })));
  if (!res.ok) return NextResponse.json({ items, status: "unavailable", reason: res.reason });
  return NextResponse.json({ items: applyGemini(items, res.byIndex ?? {}), status: "done", model: res.model });
}

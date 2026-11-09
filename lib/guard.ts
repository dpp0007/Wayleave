import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

// Abuse protection for a public deployment. Every API route is POST-only and passes through here before doing any work, because the
// expensive ones spend the owner's TinyFish and Gemini credits.
//
// Honest limits: the rate limiter is in-memory, so it is per server instance (best effort on serverless; it resets on cold starts).
// For a hard guarantee set ACCESS_CODE (a shared passcode) and/or add a Vercel Firewall rate-limit rule. See SECURITY.md.

/** [max requests, window in seconds] per client IP and route. */
const RULES = {
  start: [4, 3600], poll: [1500, 3600], verify: [40, 3600], fill: [40, 3600], summarize: [900, 3600], unlock: [10, 600],
} as const;
export type Route = keyof typeof RULES;

const hits = new Map<string, number[]>();
function limited(ip: string, route: Route): number {
  const [max, secs] = RULES[route], now = Date.now(), key = `${route}:${ip}`;
  const recent = (hits.get(key) ?? []).filter((t) => now - t < secs * 1000);
  if (recent.length >= max) { hits.set(key, recent); return Math.ceil((secs * 1000 - (now - recent[0])) / 1000); }
  recent.push(now); hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < 3600_000)) hits.delete(k); // keep memory bounded
  return 0;
}

let day = "", runs = 0;
/** Daily budget for deep-research runs (each place is one run). Returns false when today's budget is spent. */
export function chargeRuns(n: number): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) { day = today; runs = 0; }
  const cap = Number(process.env.MAX_RUNS_PER_DAY) || 60;
  if (runs + n > cap) return false;
  runs += n;
  return true;
}

const ipOf = (req: Request) => (req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";

/** Browsers send Origin / Sec-Fetch-Site on cross-site requests; the API only answers its own pages. */
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (origin) { try { if (new URL(origin).host !== req.headers.get("host")) return false; } catch { return false; } }
  const site = req.headers.get("sec-fetch-site");
  return !site || site === "same-origin" || site === "none";
}

// optional shared passcode: when ACCESS_CODE is set, expensive routes need a cookie that only the right code can mint
const code = () => process.env.ACCESS_CODE || "";
export const accessRequired = () => !!code();
const token = () => createHmac("sha256", code()).update("wayleave-access-v1").digest("hex");
export const accessCookie = () => `wl_access=${token()}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${7 * 86400}`;
export function codeMatches(attempt: string): boolean {
  const a = createHash("sha256").update(attempt).digest(), b = createHash("sha256").update(code()).digest();
  return !!code() && timingSafeEqual(a, b);
}
export function unlocked(req: Request): boolean {
  if (!accessRequired()) return true;
  const m = (req.headers.get("cookie") ?? "").match(/(?:^|;\s*)wl_access=([a-f0-9]{64})(?:;|$)/);
  return !!m && timingSafeEqual(Buffer.from(m[1]), Buffer.from(token()));
}

export const noStore = { "Cache-Control": "no-store" };
export const fail = (status: number, error: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
  NextResponse.json({ error, ...extra }, { status, headers: { ...noStore, ...headers } });

/** Returns a response to send instead of doing the work, or null to proceed. */
export function guard(req: Request, route: Route, opts: { maxBytes: number; access: boolean }): NextResponse | null {
  if (!sameOrigin(req)) return fail(403, "Cross-site requests are not allowed.");
  if (Number(req.headers.get("content-length") || 0) > opts.maxBytes) return fail(413, "Request too large.");
  if (opts.access && !unlocked(req)) return fail(401, "Access code required.", { code: "ACCESS_REQUIRED" });
  const wait = limited(ipOf(req), route);
  if (wait) return fail(429, "Too many requests. Please slow down and try again shortly.", {}, { "Retry-After": String(wait) });
  return null;
}

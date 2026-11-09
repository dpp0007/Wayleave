import type { PlaceState } from "./types";

// What a place is doing, in the order a user sees it. "Find sources" and "First look" are quick; deep research is the long wait.
export const STEPS = ["Find sources", "First look", "Deep research", "Verify live", "Fill gaps", "Gemini check"] as const;

/** Index into STEPS that is currently active for a place (STEPS.length means everything is finished). */
export function stepOf(p: PlaceState): number {
  if (!p.done) return Math.min(p.stage, 2);
  if (p.fill === "pending") return 4;
  if (p.gemini === "pending") return 5;
  return STEPS.length;
}

/**
 * Rough 0..1 progress for one place. Deep research has no real percentage, so while it runs we blend elapsed time (an asymptote
 * toward ~85%) with how much it has read, so the bar keeps moving and never reaches 100% until the work is really done.
 */
export function placeProgress(p: PlaceState, now: number): number {
  if (p.done) return p.fill === "pending" ? 0.92 : p.gemini === "pending" ? 0.96 : 1;
  const secs = Math.max(0, (now - p.startedAt) / 1000);
  if (p.stage <= 0) return Math.min(0.08, 0.02 + secs / 600);
  const read = p.activity ? Math.min(1, p.activity.sourceCount / 30) : 0;
  const time = 1 - Math.exp(-secs / 240);
  const deep = 0.18 + 0.67 * Math.max(time * 0.6 + read * 0.4, 0);
  return Math.min(0.88, p.stage === 1 ? Math.min(deep, 0.3) : deep);
}

export const overallProgress = (places: PlaceState[], now: number) =>
  places.length ? places.reduce((s, p) => s + placeProgress(p, now), 0) / places.length : 0;

/** "m:ss" */
export const clock = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

/** A hedged estimate of minutes left, or null when it would be a guess. */
export function minutesLeft(progress: number, elapsedMs: number): number | null {
  if (progress < 0.25 || elapsedMs < 150_000) return null; // deep research usually takes 4-8 min; earlier than this an estimate is a guess
  const total = elapsedMs / progress;
  return Math.max(1, Math.round((total - elapsedMs) / 60_000));
}

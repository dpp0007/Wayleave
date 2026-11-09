"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_PLACES, MIN_PLACES, type Data, type Job, type PlaceState } from "./types";

const STORE = "wayleave-job";
const POLL_MS = 6000;

class ApiError extends Error { constructor(message: string, public code?: string, public status?: number) { super(message); } }

const post = async (url: string, body: unknown) => {
  const r = await fetch(url, { method: "POST", body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(j.error || r.statusText, j.code, r.status);
  return j;
};

/** Runs at most `max` tasks at once; the rest wait their turn. */
function limiter(max: number) {
  let active = 0; const waiting: (() => void)[] = [];
  return async <T,>(fn: () => Promise<T>): Promise<T> => {
    if (active >= max) await new Promise<void>((r) => waiting.push(r));
    active++;
    try { return await fn(); } finally { active--; waiting.shift()?.(); }
  };
}

/**
 * Owns the whole comparison lifecycle so the page stays declarative:
 *   begin -> poll every place until it is final -> fill missing fees -> Gemini double-check -> summarise for display.
 * Only an in-progress job is saved in the browser (so a closed tab can resume); finished or failed jobs never come back on their own.
 */
export function useComparison() {
  const [job, setJob] = useState<Job | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsCode, setNeedsCode] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const inflight = useRef(new Set<string>());
  const checking = useRef(new Set<string>());
  const fillSlot = useRef(limiter(1));   // gap filling: one place at a time (TinyFish Search allows ~30 requests a minute; a place needs up to 8)
  const verifySlot = useRef(limiter(1)); // Gemini checks: one at a time (parallel calls queued behind each other and timed out)
  const jobRef = useRef(job); jobRef.current = job;
  const notify = useRef(false);

  const patch = useCallback((place: string, fn: (p: PlaceState) => PlaceState) =>
    setJob((cur) => cur && { ...cur, places: cur.places.map((p) => (p.place === place ? fn(p) : p)) }), []);

  const researching = !!job && job.places.some((p) => !p.done);
  const checkingFigures = !!job && job.places.some((p) => p.gemini === "pending");
  const busyWork = researching || checkingFigures;

  // is a passcode required (and already held)? Ask before the first request so the gate shows up front.
  useEffect(() => {
    fetch("/api/config").then((r) => r.json()).then((c) => setNeedsCode(!!c.accessRequired && !c.unlocked)).catch(() => {});
  }, []);

  // resume an in-progress job after a refresh; drop anything that had already finished
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE); if (!raw) return;
      const v = JSON.parse(raw);
      if (v?.places?.some((p: PlaceState) => !p.done)) setJob(v); else localStorage.removeItem(STORE);
    } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => {
    try { researching ? localStorage.setItem(STORE, JSON.stringify(job)) : localStorage.removeItem(STORE); } catch { /* ignore */ }
  }, [job, researching]);

  // one-second clock for the elapsed timer while work is running
  useEffect(() => {
    if (!busyWork) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [busyWork]);

  // poll every unfinished place; a failed poll never kills the job, it is retried on the next tick
  useEffect(() => {
    if (!researching) return;
    const tick = async () => {
      for (const p of jobRef.current?.places ?? []) {
        if (p.done || inflight.current.has(p.place)) continue;
        inflight.current.add(p.place);
        try {
          const j = await post("/api/poll", p);
          patch(p.place, (x) => j.state === "final"
            ? { ...x, done: true, report: j.report, activity: null }
            : { ...x, stage: j.stage ?? x.stage, activity: j.activity ?? x.activity, ...(j.preview ? { report: j.preview, previewSent: true } : {}) });
        } catch (e) { if ((e as ApiError).code === "ACCESS_REQUIRED") setNeedsCode(true); /* otherwise transient: next tick retries */ }
        finally { inflight.current.delete(p.place); }
      }
    };
    tick();
    const t = setInterval(tick, POLL_MS);
    return () => clearInterval(t);
  }, [researching, patch]);

  // For every finished place with something to check: look for missing fees on a second official page, then have Gemini double-check
  // the figures. Also covers a job resumed after a refresh. Both steps are best effort: a failure leaves the data as it was.
  useEffect(() => {
    for (const p of job?.places ?? []) {
      if (!p.done || p.gemini || !p.report?.items?.length || p.report.level === "failed" || checking.current.has(p.place)) continue;
      const place = p.place, start = p.report.items;
      checking.current.add(place);
      patch(place, (x) => ({ ...x, gemini: "pending", fill: "pending" }));
      fillSlot.current(async () => {
        try {
          const f = await post("/api/fill", { place, items: start });
          patch(place, (x) => ({ ...x, fill: "done", fillStats: { tried: f.tried, filled: f.filled }, report: { ...x.report, items: f.items } }));
          return f.items as any[];
        } catch { patch(place, (x) => ({ ...x, fill: "skipped" })); return start; }
      }).then((items) => verifySlot.current(() => post("/api/verify", { place, items })
        .then((j) => patch(place, (x) => ({ ...x, gemini: j.status === "done" ? "done" : "unavailable", geminiModel: j.model, geminiNote: j.reason, report: { ...x.report, items: j.items } })))
        .catch((e) => patch(place, (x) => ({ ...x, gemini: "unavailable", geminiNote: String(e.message) })))))
        .finally(() => checking.current.delete(place));
    }
  }, [job, patch]);

  // recompute table + recommendation whenever any place has a (preview or final) report
  const seq = useRef(0);
  const sig = (job?.places ?? []).map((p) => `${p.place}:${p.report?.level}:${p.report?.items?.length}:${p.gemini}:${p.fillStats?.filled}`).join("|");
  useEffect(() => {
    const reports = jobRef.current?.places.filter((p) => p.report).map((p) => p.report) ?? [];
    if (!reports.length) { setData(null); return; }
    const mine = ++seq.current;
    post("/api/summarize", { places: reports }).then((d) => { if (mine === seq.current) setData(d); }).catch(() => {});
  }, [sig]);

  // stamp the finish time once everything (including the check passes) is done
  useEffect(() => {
    if (job && !busyWork && !job.finishedAt && job.places.every((p) => p.done)) {
      setJob({ ...job, finishedAt: Date.now() });
      if (notify.current && typeof Notification !== "undefined" && Notification.permission === "granted")
        new Notification("Comparison ready", { body: `${job.activity}: ${job.places.length} places compared.` });
    }
  }, [job, busyWork]);

  // the tab title carries progress, so a backgrounded tab still tells you where things are
  useEffect(() => {
    if (!job) { document.title = "Wayleave: where is it easiest to start?"; return; }
    const done = job.places.filter((p) => p.done).length;
    document.title = researching ? `(${done}/${job.places.length}) Researching · Wayleave` : checkingFigures ? "Checking figures · Wayleave" : job.finishedAt ? "✓ Ready · Wayleave" : "Wayleave";
  }, [job, researching, checkingFigures]);

  async function begin(activity: string, places: string[]) {
    setError(""); setBusy(true); setData(null);
    try {
      const j = await post("/api/start", { activity, places });
      const startedAt = Date.now();
      setJob({ activity, startedAt, places: j.places.map((p: any) => ({ ...p, stage: 0, done: false, previewSent: false })) });
      setNow(startedAt);
      return true;
    } catch (e) {
      if ((e as ApiError).code === "ACCESS_REQUIRED") setNeedsCode(true);
      setError((e as Error).message); return false;
    } finally { setBusy(false); }
  }

  const reset = () => { setJob(null); setData(null); setError(""); };
  const retry = () => job && begin(job.activity, job.places.map((p) => p.place));

  /** Show a saved run exactly as it was: no research is started and no checks are re-run, so opening one never spends credits. */
  const open = (saved: { activity: string; places: any[] }) => {
    setError("");
    setJob({ activity: saved.activity, startedAt: 0, finishedAt: 1, places: saved.places.map((p) => ({
      place: p.place, seeds: [], notes: [], researchId: null, agentId: null, startedAt: 0, stage: 2, done: true, previewSent: true, report: p,
      fill: "done", fillStats: p.fill_stats, gemini: p.items?.some((i: any) => i.gemini) ? "done" : "unavailable", geminiModel: p.gemini_model, geminiNote: "not run on this saved run",
    })) });
  };

  /** Exchange the shared passcode for an access cookie (only when the deployment sets ACCESS_CODE). */
  const unlock = async (code: string) => { await post("/api/unlock", { code }); setNeedsCode(false); setError(""); };

  const askNotify = async () => {
    if (typeof Notification === "undefined") return false;
    const perm = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    notify.current = perm === "granted";
    return notify.current;
  };

  return { job, data, error, busy, now, researching, checkingFigures, needsCode, begin, reset, retry, open, unlock, askNotify,
    limits: { min: MIN_PLACES, max: MAX_PLACES } };
}

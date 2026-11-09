"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_PLACES, MIN_PLACES, type Data, type Job, type PlaceState } from "./types";

const STORE = "wayleave-job";
const POLL_MS = 6000;

const post = async (url: string, body: unknown) => {
  const r = await fetch(url, { method: "POST", body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
};

/**
 * Owns the whole comparison lifecycle so the page stays declarative:
 *   begin -> poll every place until it is final -> Gemini double-check each finished place -> summarise for display.
 * Only an in-progress job is saved in the browser (so a closed tab can resume); finished or failed jobs never come back on their own.
 */
export function useComparison() {
  const [job, setJob] = useState<Job | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const inflight = useRef(new Set<string>());
  const checking = useRef(new Set<string>());
  const gemQueue = useRef<Promise<unknown>>(Promise.resolve()); // Gemini checks run one at a time
  const jobRef = useRef(job); jobRef.current = job;
  const notify = useRef(false);

  const patch = useCallback((place: string, fn: (p: PlaceState) => PlaceState) =>
    setJob((cur) => cur && { ...cur, places: cur.places.map((p) => (p.place === place ? fn(p) : p)) }), []);

  const researching = !!job && job.places.some((p) => !p.done);
  const checkingFigures = !!job && job.places.some((p) => p.gemini === "pending");
  const busyWork = researching || checkingFigures;

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
        } catch { /* transient: next tick retries */ } finally { inflight.current.delete(p.place); }
      }
    };
    tick();
    const t = setInterval(tick, POLL_MS);
    return () => clearInterval(t);
  }, [researching, patch]);

  // Gemini double-check for every finished place that has something to check (also covers a job resumed after a refresh)
  useEffect(() => {
    for (const p of job?.places ?? []) {
      if (!p.done || p.gemini || !p.report?.items?.length || p.report.level === "failed" || checking.current.has(p.place)) continue;
      checking.current.add(p.place);
      patch(p.place, (x) => ({ ...x, gemini: "pending" }));
      const items = p.report.items;
      gemQueue.current = gemQueue.current.then(() => post("/api/verify", { place: p.place, items })
        .then((j) => patch(p.place, (x) => ({ ...x, gemini: j.status === "done" ? "done" : "unavailable", geminiModel: j.model, geminiNote: j.reason, report: { ...x.report, items: j.items } })))
        .catch((e) => patch(p.place, (x) => ({ ...x, gemini: "unavailable", geminiNote: String(e.message) })))
        .finally(() => checking.current.delete(p.place)));
    }
  }, [job, patch]);

  // recompute table + recommendation whenever any place has a (preview or final) report
  const seq = useRef(0);
  const sig = (job?.places ?? []).map((p) => `${p.place}:${p.report?.level}:${p.report?.items?.length}:${p.gemini}`).join("|");
  useEffect(() => {
    const reports = jobRef.current?.places.filter((p) => p.report).map((p) => p.report) ?? [];
    if (!reports.length) { setData(null); return; }
    const mine = ++seq.current;
    post("/api/summarize", { places: reports }).then((d) => { if (mine === seq.current) setData(d); }).catch(() => {});
  }, [sig]);

  // stamp the finish time once everything (including the Gemini pass) is done
  useEffect(() => {
    if (job && !busyWork && !job.finishedAt && job.places.every((p) => p.done)) {
      setJob({ ...job, finishedAt: Date.now() });
      if (notify.current && typeof Notification !== "undefined" && Notification.permission === "granted")
        new Notification("Comparison ready", { body: `${job.activity}: ${job.places.length} places compared.` });
    }
  }, [job, busyWork]);

  // the tab title carries progress, so a backgrounded tab still tells you where things are
  useEffect(() => {
    if (!job) { document.title = "Wayleave"; return; }
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
    } catch (e) { setError((e as Error).message); return false; } finally { setBusy(false); }
  }

  const reset = () => { setJob(null); setData(null); setError(""); };
  const retry = () => job && begin(job.activity, job.places.map((p) => p.place));

  /** Show a saved run exactly as it was (no research is started). */
  const open = (saved: { activity: string; places: any[] }) => {
    setError("");
    setJob({ activity: saved.activity, startedAt: 0, finishedAt: 1, places: saved.places.map((p) => ({
      place: p.place, seeds: [], notes: [], researchId: null, agentId: null, startedAt: 0, stage: 2, done: true, previewSent: true, report: p,
    })) });
  };

  const askNotify = async () => {
    if (typeof Notification === "undefined") return false;
    const perm = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    notify.current = perm === "granted";
    return notify.current;
  };

  return { job, data, error, busy, now, researching, checkingFigures, begin, reset, retry, open, askNotify,
    limits: { min: MIN_PLACES, max: MAX_PLACES } };
}

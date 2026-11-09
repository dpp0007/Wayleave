"use client";
/**
 * Hero + input for Wayleave.
 * Remixed from "Hero Intro Animation" by Yahia Bakour (@mynameisyahia), lookap entry 5h6d0-hero-intro-animation
 * (https://x.com/i/status/2083110817055306161). Kept from the original: the layout and proportions (frame 2110x1080, every size
 * in --u = one source pixel), the spacing rhythm, the card-over-liquid composition, and the motion order and timing: a placeholder
 * that types a decoy, deletes it, types a phrase, holds, deletes back and types a second phrase, over a water surface that swells,
 * slows and freezes at 4.5s. Replaced with this project's own: copy, colour tokens, fonts, icons and the activity data.
 */
import { animate, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildScript, scriptEnd, textAt } from "@/lib/typeScript";
import { MAX_PLACES, MIN_PLACES } from "@/lib/types";
import WaterShader from "./WaterShader";
import { Spinner, cx } from "./ui";

export const TABS = [
  { label: "Café", value: "open a small café serving food and coffee", d: "M5 9h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M12 3v3" },
  { label: "Drone business", value: "operate a commercial drone business", d: "M12 10v4M6.5 6.5l4 4M17.5 6.5l-4 4M6.5 17.5l4-4M17.5 17.5l-4-4M4 4h5M15 4h5M4 20h5M15 20h5" },
  { label: "Food truck", value: "start a food truck", d: "M3 7h11v9H3zM14 10h4l3 3v3h-7M8 19.2h.01M18 19.2h.01" },
  { label: "Daycare", value: "open a daycare centre", d: "M4 19h16M6 19V10l6-5 6 5v9M10 19v-5h4v5" },
  { label: "Bar or pub", value: "open a bar or pub", d: "M5 4h14l-7 8zM12 12v7M8 19h8" },
  { label: "Coworking", value: "run a coworking space", d: "M5 6h14v9H5zM3 18h18" },
] as const;

const SUGGESTED = ["Singapore", "London, United Kingdom", "Dubai, UAE", "Texas, USA", "Berlin, Germany", "Sydney, Australia", "Toronto, Canada"];
const SCRIPT = buildScript("st", "open a café", 4, "start a daycare"); // typed suffix after "I want to"

type Props = {
  activity: string; setActivity: (a: string) => void;
  places: string[]; setPlaces: (p: string[]) => void;
  onSubmit: () => void; busy: boolean; running: boolean; error: string;
};

export default function Hero({ activity, setActivity, places, setPlaces, onSubmit, busy, running, error }: Props) {
  const reduce = useReducedMotion();
  const [typed, setTyped] = useState("");
  const [touched, setTouched] = useState(false);
  const [draft, setDraft] = useState("");
  const run = useRef<ReturnType<typeof animate> | null>(null);
  const last = useRef("");
  const placeInput = useRef<HTMLInputElement>(null);

  // Placeholder timeline: one Motion clock, text looked up from the measured keystroke schedule. Any interaction stops it.
  useEffect(() => {
    if (touched) return;
    if (reduce) { setTyped("open a café"); return; }
    run.current = animate(0, scriptEnd(SCRIPT), {
      duration: scriptEnd(SCRIPT), ease: "linear",
      onUpdate: (t) => { const s = textAt(SCRIPT, t); if (s !== last.current) { last.current = s; setTyped(s); } },
    });
    return () => run.current?.stop();
  }, [reduce, touched]);

  const take = (value: string) => { run.current?.stop(); setTouched(true); setActivity(value); };
  // if the activity is set from outside (e.g. opening a saved run), the field must show it, not the typing demo
  useEffect(() => { if (!touched && activity !== TABS[0].value) { run.current?.stop(); setTouched(true); } }, [activity, touched]);
  const active = useMemo(() => TABS.findIndex((t) => t.value === activity), [activity]);
  const add = (raw: string) => {
    const v = raw.trim().replace(/,$/, "");
    if (v && places.length < MAX_PLACES && !places.some((x) => x.toLowerCase() === v.toLowerCase())) setPlaces([...places, v]);
    setDraft("");
  };
  const valid = activity.trim().length > 2 && places.length >= MIN_PLACES;
  const hint = places.length < MIN_PLACES ? `Add ${MIN_PLACES - places.length} more place${MIN_PLACES - places.length > 1 ? "s" : ""} to compare (${MIN_PLACES}-${MAX_PLACES})` : `${places.length} places · up to ${MAX_PLACES}`;
  const text = "text-[max(14px,calc(24*var(--u)))]";

  return (
    <section id="top" aria-label="Wayleave" style={{ ["--u" as string]: "max(0.52px, min(1px, calc(100vw / 2110)))" }}
      className="relative isolate w-full overflow-hidden [--hero-deep:var(--accent)] dark:[--hero-deep:color-mix(in_oklab,var(--accent)_50%,var(--surface))] print:hidden">
      {/* page background: near-white at the top, tinted by ~y620, saturated by ~y910 (stops measured from the clip), warm at the very bottom */}
      <div aria-hidden className="absolute inset-0 -z-20" style={{ background: "linear-gradient(to bottom, var(--surface) 0%, var(--surface) 22%, color-mix(in oklab, var(--accent) 24%, var(--surface)) 59%, var(--hero-deep) 86%, color-mix(in oklab, var(--warm) 72%, var(--hero-deep)) 100%)" }} />
      <WaterShader className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[calc(275*var(--u))] opacity-90 [mask-image:linear-gradient(to_top,#000_55%,transparent)]" />

      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-[5] h-[calc(340*var(--u))] min-h-24 bg-gradient-to-b from-transparent to-bg" />

      <div className="relative flex flex-col items-center px-4 pt-[max(40px,calc(90*var(--u)))] pb-[max(40px,calc(110*var(--u)))] text-center">
        <p className="m-0 flex items-center gap-[calc(9*var(--u))] text-[max(13px,calc(19*var(--u)))] font-medium text-mut">
          Built on
          <span aria-hidden className="grid size-[max(18px,calc(24*var(--u)))] place-items-center rounded-[calc(6*var(--u))] bg-accent text-[max(11px,calc(15*var(--u)))] font-bold text-white">✓</span>
          TinyFish Research
        </p>

        <h1 className="mt-[calc(42*var(--u))] max-w-[calc(1038*var(--u))] text-[max(30px,calc(76*var(--u)))] leading-[1.09] text-ink" style={{ fontWeight: 400, letterSpacing: "-0.03em", minWidth: "min(100%, 320px)" }}>
          Compare <span className="text-accent">licences &amp; fees</span><br />
          from <span className="text-warm">official sources</span>
        </h1>
        <p className="mt-[calc(39*var(--u))] max-w-[calc(800*var(--u))] text-[max(15px,calc(23*var(--u)))] leading-snug text-mut" style={{ minWidth: "min(100%, 300px)" }}>
          One activity, a few places, every cited page verified live and double-checked by Gemini.
        </p>

        {/* card: 1256 wide, radius 24, translucent */}
        <form onSubmit={(e) => { e.preventDefault(); if (!touched) take(activity); if (valid && !busy && !running) onSubmit(); }}
          className="mt-[calc(48*var(--u))] w-[min(calc(1256*var(--u)),100%)] min-w-[min(100%,330px)] rounded-[max(16px,calc(24*var(--u)))] border border-white/40 bg-surface/75 p-[calc(18*var(--u))] shadow-[0_calc(30*var(--u))_calc(80*var(--u))_calc(-30*var(--u))_rgba(25,25,80,.35)] backdrop-blur-md">
          <div role="tablist" aria-label="Activity presets" className="flex h-[max(40px,calc(48*var(--u)))] items-center gap-[calc(6*var(--u))] overflow-x-auto [scrollbar-width:none]">
            {TABS.map((t, i) => (
              <button key={t.label} role="tab" type="button" aria-selected={active === i} onClick={() => take(t.value)}
                className={cx("flex h-full shrink-0 items-center gap-[max(6px,calc(10*var(--u)))] rounded-[max(10px,calc(14*var(--u)))] border-0 px-[max(10px,calc(16*var(--u)))] text-[max(13px,calc(19*var(--u)))] font-medium transition-colors", active === i ? "bg-surface text-ink shadow-sm" : "bg-transparent text-mut hover:text-ink")}>
                <span className={cx("grid size-[max(18px,calc(26*var(--u)))] place-items-center rounded-[calc(7*var(--u))]", active === i ? "bg-gradient-to-br from-accent to-warm text-white" : "bg-line text-faint")}>
                  <svg viewBox="0 0 24 24" className="size-[70%]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={t.d} /></svg>
                </span>
                {t.label}
              </button>
            ))}
          </div>

          {/* activity: fixed prefix + typed suffix (this is the real field; focusing it stops the typing) */}
          <div className="mt-[calc(19*var(--u))] flex h-[max(52px,calc(77*var(--u)))] items-center rounded-[max(12px,calc(16*var(--u)))] bg-[color-mix(in_oklab,var(--accent)_14%,var(--surface))] px-[max(14px,calc(24*var(--u)))]">
            <label htmlFor="hero-activity" className={cx("shrink-0 font-semibold text-ink/70", text)}>I want to&nbsp;</label>
            <input id="hero-activity" value={touched ? activity : typed} readOnly={!touched} autoComplete="off" spellCheck={false}
              onFocus={() => { if (!touched) take(typed || activity); }} onChange={(e) => setActivity(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); placeInput.current?.focus(); } }}
              className={cx("h-full min-w-0 flex-1 border-0 bg-transparent p-0 font-medium text-faint outline-none focus:text-ink", text)} />
          </div>

          {/* places: chips + inline add; the same row holds the submit button */}
          <div className="mt-[calc(12*var(--u))] flex flex-wrap items-center gap-2 rounded-[max(12px,calc(16*var(--u)))] bg-[color-mix(in_oklab,var(--accent)_8%,var(--surface))] p-2 pl-[max(14px,calc(24*var(--u)))]">
            <span className={cx("font-semibold text-ink/70", text)}>in</span>
            {places.map((p) => (
              <span key={p} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface py-1 pr-1 pl-3 text-sm text-ink">
                {p}
                <button type="button" aria-label={`Remove ${p}`} onClick={() => setPlaces(places.filter((x) => x !== p))} className="grid size-5 place-items-center rounded-full text-mut hover:bg-line">×</button>
              </span>
            ))}
            <input ref={placeInput} value={draft} disabled={places.length >= MAX_PLACES} placeholder={places.length >= MAX_PLACES ? "" : "Add a city, state or country"}
              onChange={(e) => setDraft(e.target.value)} aria-label="Add a place"
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { if (draft.trim()) { e.preventDefault(); add(draft); } } else if (e.key === "Backspace" && !draft) setPlaces(places.slice(0, -1)); }}
              onBlur={() => draft.trim() && add(draft)}
              className="h-9 min-w-[10rem] flex-1 border-0 bg-transparent px-2 text-sm text-ink outline-none placeholder:text-faint" />
            <button disabled={!valid || busy || running}
              className="ml-auto inline-flex h-[max(40px,calc(56*var(--u)))] items-center gap-2 rounded-[max(10px,calc(14*var(--u)))] border-0 bg-primary px-5 text-[max(14px,calc(19*var(--u)))] font-semibold text-primary-ink transition hover:opacity-90 active:scale-[0.98] disabled:opacity-40">
              {busy ? <><Spinner /> Starting</> : running ? <><Spinner /> Researching</> : <>Compare places <span aria-hidden>→</span></>}
            </button>
          </div>

          {/* suggestions only while there is room, so the card stays calm */}
          {places.length < MAX_PLACES && (
            <div className="mt-2 flex flex-wrap gap-1.5 pl-1">
              {SUGGESTED.filter((p) => !places.includes(p)).slice(0, 5).map((p) => (
                <button key={p} type="button" onClick={() => add(p)} className="rounded-full border border-dashed border-line2 bg-transparent px-2.5 py-0.5 text-xs text-mut transition hover:border-ink hover:text-ink">+ {p}</button>
              ))}
            </div>
          )}
        </form>

        <p role={error ? "alert" : undefined} className={cx("mt-[calc(30*var(--u))] max-w-xl rounded-lg px-3 py-1.5 text-[max(13px,calc(19*var(--u)))] font-semibold", error ? "bg-bad-soft text-bad" : "text-white [text-shadow:0_1px_10px_rgba(0,0,0,.25)] dark:text-ink")}>
          {error || hint}
        </p>
      </div>
    </section>
  );
}

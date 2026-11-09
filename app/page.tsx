"use client";
import { useEffect, useState } from "react";
import About from "@/components/About";
import Hero, { TABS } from "@/components/Hero";
import Nav from "@/components/Nav";
import RunRoom from "@/components/RunRoom";
import Checks from "@/components/results/Checks";
import CostBreakdown from "@/components/results/CostBreakdown";
import ExportBar from "@/components/results/ExportBar";
import Matrix from "@/components/results/Matrix";
import PlaceCards from "@/components/results/PlaceCards";
import Verdict from "@/components/results/Verdict";
import { Badge, Card, SectionTitle, Spinner, button, cx } from "@/components/ui";
import { clock } from "@/lib/progress";
import { useComparison } from "@/lib/useComparison";

const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

export default function Page() {
  const c = useComparison();
  const { job, data } = c;
  const [activity, setActivity] = useState<string>(TABS[0].value);
  const [places, setPlaces] = useState<string[]>(["Singapore", "London, United Kingdom", "Dubai, UAE"]);
  const [samples, setSamples] = useState<{ file: string; activity: string }[]>([]);

  useEffect(() => { fetch("/demos/index.json").then((r) => (r.ok ? r.json() : [])).then(setSamples).catch(() => {}); }, []);

  const submit = async () => { if (await c.begin(activity, places)) setTimeout(() => jump("results"), 150); };
  const openSaved = async (file: string) => {
    const d = await (await fetch(`/demos/${file}`)).json();
    setActivity(d.activity); setPlaces(d.places.map((p: any) => p.place));
    c.open(d);
    setTimeout(() => jump("results"), 150);
  };
  const focusHero = () => { jump("top"); setTimeout(() => document.getElementById("hero-activity")?.focus({ preventScroll: true }), 500); };
  const startOver = () => { c.reset(); focusHero(); };

  const allFailed = !!job && job.places.every((p) => p.done && p.report?.level === "failed");
  const pending = job?.places.filter((p) => !p.done).map((p) => p.place) ?? [];
  const winner = data?.recommendation.ranking[0]?.place;
  const finished = !!job && !c.researching;
  // results so far: only places whose research is final (first-look previews are already shown in the research room)
  const doneNames = new Set(job?.places.filter((p) => p.done && p.report?.level !== "failed").map((p) => p.place));
  const partial = data && doneNames.size ? { ...data, places: data.places.filter((p) => doneNames.has(p.place)), recommendation: { ...data.recommendation, ranking: [] } } : null;
  const degraded = job?.places.filter((p) => p.done && p.report && p.report.level !== "full" && p.notes.length) ?? [];

  const results = job && (
    <section id="results" className="scroll-mt-28 pt-8 md:scroll-mt-24">
      <SectionTitle aside={finished && !allFailed && <Badge tone="ok">✓ Done{job.finishedAt && job.startedAt > 0 ? ` in ${clock(job.finishedAt - job.startedAt)}` : ""}</Badge>}>{job.activity}</SectionTitle>

      {c.researching && (
        <div className="space-y-5">
          <RunRoom job={job} now={c.now} onNotify={c.askNotify} />
          {partial && <><PlaceCards places={partial.places} pending={pending} /><Matrix data={partial} /></>}
        </div>
      )}

      {allFailed && (
        <Card className="space-y-4">
          <div role="alert"><h3 className="text-xl">We couldn’t assess these places</h3>
            <p className="mt-1 text-sm text-mut">Nothing here is a finding. “Not assessed” never means “no requirements”.</p></div>
          <ul className="space-y-2 text-sm">{job.places.map((p) => <li key={p.place} className="flex gap-2.5"><span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-bad-soft text-[11px] font-bold text-bad">!</span><span><b>{p.place}</b>: {[...new Set([...p.notes, ...(p.report?.notes ?? [])])].join(" ") || "no usable data came back."}</span></li>)}</ul>
          <div className="flex gap-2"><button onClick={() => c.retry()} disabled={c.busy} className={button.primary}>Try again</button><button onClick={startOver} className={button.ghost}>Start over</button></div>
        </Card>
      )}

      {data && finished && !allFailed && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm text-mut">{c.checkingFigures ? <><Spinner className="text-accent" /> Gemini is double-checking the figures…</> : `Compared ${job.places.length} places from official sources.`}</p>
            <ExportBar data={data} activity={job.activity} />
          </div>
          <Verdict r={data.recommendation} />
          <PlaceCards places={data.places} winner={winner} pending={[]} />
          <CostBreakdown places={data.places} />
          <Checks data={data} states={job.places} />
          {degraded.length > 0 && (
            <Card className="p-4"><div className="text-xs font-semibold tracking-wide text-mut uppercase">Data quality notes</div>
              <ul className="mt-2 space-y-1.5 text-sm">{degraded.map((p) => <li key={p.place}><b>{p.place}</b> <span className="text-mut">({p.report.level}):</span> {[...new Set([...p.notes, ...(p.report?.notes ?? [])])].join(" ")}</li>)}</ul></Card>
          )}
          <Matrix data={data} />
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-mut">
            <p className="max-w-3xl">Totals cover start-up steps only; recurring duties are listed separately. Time is the sum of step maxima (an upper bound if steps run one after another). This is an informational comparison from official pages, not legal advice. Confirm with a local professional before acting.</p>
            <button onClick={startOver} className={cx(button.ghost, "print:hidden")}>Start a new comparison</button>
          </div>
        </div>
      )}

      {!data && finished && !allFailed && <Card className="text-sm text-mut">Loading comparison…</Card>}
    </section>
  );

  const saved = (
    <section id="samples" className="scroll-mt-28 pt-4 md:scroll-mt-24 print:hidden">
      <SectionTitle>Saved live runs</SectionTitle>
      {samples.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {samples.map((x) => (
            <button key={x.file} type="button" onClick={() => openSaved(x.file)} className="rounded-2xl border border-line bg-surface p-4 text-left transition hover:border-ink active:scale-[0.99]">
              <div className="font-serif text-lg font-semibold">{x.activity}</div>
              <div className="mt-1 text-sm text-mut">Real TinyFish research with every cited page re-read. Opens instantly; Gemini re-checks the figures live.</div>
            </button>
          ))}
        </div>
      ) : <p className="text-sm text-mut">No saved runs yet.</p>}
    </section>
  );

  return <>
    <Nav onCompare={focusHero} onSample={() => samples[0] && openSaved(samples[0].file)} hasSample={samples.length > 0} hasResults={!!job} />
    <Hero activity={activity} setActivity={setActivity} places={places} setPlaces={setPlaces} onSubmit={submit} busy={c.busy} running={c.researching} error={c.error} />

    {/* first visit: the explanation comes straight after the hero. With a comparison open: results first, explanation last. */}
    <main className="mx-auto max-w-[1240px] space-y-16 px-4 pb-16">
      {job ? <>{results}{saved}<About /></> : <><div className="pt-2"><About /></div>{saved}</>}
    </main>

    <footer className="border-t border-line print:hidden">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-mut">
        <p>Built with TinyFish Research, Search, Fetch and Agent, and Gemini. Informational only, not legal advice.</p>
        <p>Hero remixed from “Hero Intro Animation” by Yahia Bakour (lookap).</p>
      </div>
    </footer>
  </>;
}

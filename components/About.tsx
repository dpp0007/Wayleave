import { Card, Eyebrow, SectionTitle } from "./ui";

const FEATURES = [
  { t: "Same requirements, side by side", d: "Registration, licences, inspections, tax, insurance and recurring duties, in one fixed structure for every place, so you compare like with like.", i: "M4 5h16v14H4zM4 11h16M10 5v14" },
  { t: "Every item sourced and dated", d: "Each row links to the official page it came from, shows the date it was checked, and keeps the quoted text so you can see it for yourself.", i: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" },
  { t: "Costs and timelines, honestly", d: "Start-up cost and time to approval, with renewals and filings. A fee that isn't stated is flagged as a gap, never guessed and never counted as free.", i: "M12 3v18M16 7.5c0-1.4-1.8-2.5-4-2.5s-4 1.1-4 2.5 1.8 2.5 4 2.5 4 1.1 4 2.5-1.8 2.5-4 2.5-4-1.1-4-2.5" },
  { t: "A recommendation with trade-offs", d: "Where it is easiest to start, why, and what to keep in mind, from a transparent score you can read: cost, time, steps, and how well each place is sourced.", i: "M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.3l6-.7z" },
  { t: "Figures that are double-checked", d: "Cited pages are re-opened live. Gemini re-reads each fee, currency and time against the page text, and exchange rates are compared across independent sources.", i: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12l3 3 5-6" },
  { t: "Ready to hand to a lawyer", d: "Copy the whole comparison as Markdown, print it or save it as a PDF, or download the raw data. Every row keeps its source link.", i: "M12 4v11M8 11l4 4 4-4M5 20h14" },
] as const;

const STEPS = [
  { n: "1", t: "Find the official pages", by: "TinyFish Search", d: "For each place, government and regulator sites are found first, so the research starts from official sources rather than blogs." },
  { n: "2", t: "Read them in depth", by: "TinyFish Research", d: "One deep run per place, all in parallel. It plans questions, reads dozens of pages in rounds and extracts every requirement into one fixed structure. A quick one-page read gives a first look in about a minute while this runs (4 to 8 minutes)." },
  { n: "3", t: "Re-open and verify", by: "TinyFish Fetch", d: "Every cited page is opened again, live, and the quoted text must be on it. A number that appears only as “36 months” or “20%” is not accepted as a fee." },
  { n: "4", t: "Get a second opinion", by: "Gemini + live rates", d: "Gemini checks each fee, currency and time against the page text, and catches things like an ambiguous “$”. Exchange rates are cross-checked across three independent live sources." },
] as const;

const LIMITS = [
  ["Not legal advice", "It is a decision aid. Hand it to a local professional to confirm before you act."],
  ["Gaps are shown, not filled", "Where an official page doesn't state a fee or a time, you see a gap. Places that could not be researched are marked “Not assessed”, never “no requirements”."],
  ["Start-up focus", "Totals cover the steps to get started. Renewals and recurring filings are listed separately. Time is an upper bound, because steps may run in parallel."],
  ["Licences held are out of scope", "It tells you what is required, not whether a particular person or business holds a licence."],
] as const;

const FAQ = [
  ["How long does it take?", "A first look appears in about a minute. Deep research takes roughly 4 to 8 minutes for all places at once. You can keep the tab open in the background; the title shows progress, and you can ask for a notification."],
  ["Which activities and places work?", "Any activity you can describe, in any city, state or country with public government pages. Coverage varies: when a place yields little, it is labelled and not ranked as if it were complete."],
  ["How much does it cost to run?", "Each place is one TinyFish deep-research run. The first two each day are free, then about $2 each, so a three-place comparison uses three runs. Gemini calls are small, one per place."],
  ["Can I trust the numbers?", "Each figure is tied to a quote on an official page that is re-opened live, then checked again by Gemini. A figure the page doesn't support is dropped from totals and flagged. It still needs a professional's confirmation."],
  ["What happens when a rule is unclear?", "It is marked “unclear” or listed as a gap with the reason, and the totals say “at least”. The recommendation says when a metric could not be scored and marks itself provisional."],
] as const;

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
);

/** Explains the product on the first visit: the problem, what you get, how it works, the honest limits, and common questions. */
export default function About() {
  return (
    <div id="how" className="scroll-mt-28 space-y-16 md:scroll-mt-24">
      <section>
        <div className="max-w-3xl">
          <Eyebrow>Why it exists</Eyebrow>
          <h2 className="mt-2 text-3xl leading-tight md:text-4xl">Starting a business somewhere shouldn’t start with forty browser tabs.</h2>
          <p className="mt-4 text-mut">Every place has its own licences, filings, fees and waiting times, scattered across ministries, city councils and PDFs. Wayleave reads the official pages for you, lines the requirements up place by place, and tells you where it is easiest to start, with every claim traced back to its source.</p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.t} className="p-5">
              <div className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent"><Icon d={f.i} /></div>
              <h3 className="mt-3 text-lg">{f.t}</h3>
              <p className="mt-1 text-sm text-mut">{f.d}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>How it works</SectionTitle>
        <ol className="grid gap-3 md:grid-cols-2">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-4 rounded-2xl border border-line bg-surface p-5">
              <div className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-warm text-sm font-semibold text-white">{s.n}</div>
              <div>
                <div className="flex flex-wrap items-baseline gap-x-2"><h3 className="text-lg">{s.t}</h3><span className="text-xs font-medium text-accent">{s.by}</span></div>
                <p className="mt-1 text-sm text-mut">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <SectionTitle>Good to know</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {LIMITS.map(([t, d]) => (
            <div key={t} className="rounded-2xl border border-line bg-sunk/60 p-5">
              <h3 className="text-base">{t}</h3>
              <p className="mt-1 text-sm text-mut">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Questions</SectionTitle>
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {q}<span aria-hidden className="text-mut transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 max-w-3xl text-sm text-mut">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

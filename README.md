<p align="center"><img src="public/logo.svg" alt="Wayleave" height="44"></p>

# Wayleave

**Where is it easiest to start?** *(A wayleave is a permission to pass: the permissions you need to operate somewhere, compared across places.)* Pick one activity (a café, a drone business, a daycare…) and 3 to 5 places. Wayleave reads each place's official rules and lines up every licence, filing, cost and time to approval side by side, with a recommendation and the trade-offs. Every item links to the official page it came from and the date it was checked.

It is a decision aid for a founder, to be handed to a lawyer for confirmation. It is not legal advice, and it does not check whether a person or business holds a licence (that is TinyVerify).

## What you get

- **One input, one flow.** Type what you want to do, add places, press Compare. No signup, no setup screens.
- **A research room that is worth watching.** Deep research takes 4 to 8 minutes, so the wait shows real progress: a timer, per-place progress, the question each place is investigating right now, the official pages being read as they arrive (with how many facts each yielded), a first look at early findings, and short notes on how the checking works. The tab title carries progress, and you can ask for a notification when it's done.
- **A verdict first.** The recommended place, two or three reasons, and the caveats, with a transparent score beside it.
- **Same requirements, lined up.** Registration, licences, inspections, tax, insurance and recurring duties for every place. The table opens with an at-a-glance block (best value highlighted), then compact cells: the most useful items first with their fee, time and one status badge, and everything else behind "Read more" or "+N more". Filter by kind or by flagged items, or open all details.
- **Costs that say what they are.** The cost figure is labelled "fees stated by officials", with how many steps are priced and a plain warning when it is only a floor. A "Where the costs go" panel lists each priced step (biggest first), names the steps with no stated fee, and spells out what no total includes: renewals, professional fees, premises and fit-out, insurance premiums, taxes.
- **Gaps filled, never guessed.** For start-up steps with no stated fee or time, Wayleave searches a second official page and Gemini extracts the figure *from that page only*. It is accepted only if the quote is really on the page and the amount is in the quote. Everything else stays a gap. Results vary a little from run to run.
- **Checks you can see.** A "How this was checked" panel shows sources re-read live, the gap-filling outcome, Gemini's verdicts on the figures, and the exchange-rate cross-check.
- **Take it with you.** Copy as Markdown (for an email or a lawyer), print or save as PDF, or download the JSON.

## How it works

```
 activity + places
        │
        ▼
 Search ──► finds official-looking pages per place (seeds the research)
        │
        ├─► Agent (quick read, ~1-2 min) ──► "first look" preview while the long step runs
        │
        ▼
 Research (deep, ~4-8 min) ──► one report per place in a fixed schema:
        │                       fee range + currency, time, renewal, filing, source URL, verbatim quote
        ▼
 Fetch ──► re-opens every cited page LIVE and checks the quote is on it
        │   (a fee must appear as an amount, not as "36 months" or "20%")
        ▼
 Fill gaps ──► Search (official hosts) + Fetch + Gemini look for missing fees/times on a
        │       second page; accepted only if the quote is on the page and the amount is in it
        ▼
 Gemini ──► re-reads each figure, currency and time against the page text (second opinion)
        │
        ▼
 FX cross-check ──► every currency compared across three independent live sources
        │
        ▼
 side-by-side matrix · transparent score · recommendation · export
```

| TinyFish API | Role |
|---|---|
| **Research** | The core. One deep run per place, all places in parallel, forced into one JSON shape so the table is comparable. Its working state (plan, sources read, facts found) drives the live feed. |
| **Search** | Finds government pages per place; they seed the research and pick the page for the quick read. It is also used to hunt for missing fees on other official pages (gap filling). |
| **Fetch** | Re-opens each cited page and verifies the quote, so nothing a model wrote is shown as verified unless the page backs it up. It also reads the candidate pages for gap filling. |
| **Agent** | The quick read: one official page, ~6 items, in about a minute. It becomes the first-look preview and the fallback if research fails. |

## What is verified, and how

| Layer | What it catches | How |
|---|---|---|
| **Page check** (Fetch) | A quote that isn't on the cited page; an unreadable page | Page re-opened live; quote matched exactly or fuzzily |
| **Fee check** | A validity period or a percentage read as a fee (e.g. "36 months" taken as S$36) | A stated fee must appear on the page as an amount; otherwise it is dropped from totals and flagged |
| **Gap filling** | A fee or time the first page left out | A figure found on a second official page is accepted only if its quote is on that page and every number is in the quote. A zero fee must be stated as free. Rejected finds leave the gap as it was |
| **Gemini** | A fee, currency or time the page text doesn't support; an ambiguous "$" | One batched call per place, judged only from the quote and page excerpt. A suggested correction is accepted only if the new number is in the source text; an unsure currency is kept out of USD totals |
| **FX cross-check** | A conversion rate one provider got wrong | Primary rate from open.er-api.com, compared with the jsDelivr currency-api and the ECB (via Frankfurter). More than 1.5% apart is flagged |

Honesty rules, in code:

- A missing fee or time is `null`, listed as a gap and shown as "not stated". Totals say "at least".
- Unstated is never scored as cheap or fast. Cost and time count toward the score only when at least two places state them for half their steps; otherwise the recommendation says they were not scored and marks itself provisional.
- A place that could not be assessed is "Not assessed", excluded from the ranking, and never read as "no requirements".
- Totals cover start-up steps only; recurring duties are listed separately. Time is the sum of step maxima, an upper bound.
- Gemini does not look up exchange rates (a model answering from memory would be guessing), so rates are cross-checked against live sources instead. USD figures are indicative; the local-currency totals are authoritative.

## Quick start

```bash
npm install
cp .env.example .env.local     # then fill in the two keys
npm run dev                    # http://localhost:3000
```

| Variable | Required | Purpose |
|---|---|---|
| `TINYFISH_API_KEY` | yes | Search, Fetch, Agent and Research. Research must be enabled on the account. |
| `GEMINI_API_KEY` | for the double-check | Also accepted as `Gemni_API`. Never sent to the browser. |
| `GEMINI_MODEL` | no | Preferred model. Falls back to `gemini-3.1-flash-lite`, then `gemini-3.5-flash`. |
| `RESEARCH_DEADLINE_MIN` | no | Minutes before deep research is cut off and its partial report used (default 8). |
| `ACCESS_CODE` | recommended for public sites | A shared passcode. When set, the paid routes require it (HttpOnly cookie). |
| `MAX_RUNS_PER_DAY` | no | Daily budget of deep-research runs, one per place (default 60). Best effort per server instance. |
| `NEXT_PUBLIC_SITE_URL` | no | Public origin for the sitemap and metadata. On Vercel the production domain is detected. |

`.env.local` wins over an existing `TINYFISH_API_KEY` in your shell (see `next.config.mjs`), so a stale system variable can't silently break the app. If Gemini is not configured or unavailable, the app still works and says the double-check was not run.

**Cost.** The first 2 deep research runs each UTC day are free, then $2 per run; a 3-place comparison is 3 runs. Gemini calls are small (two per place). Search (about 30 requests a minute) and Fetch are free within their allowances. Opening a saved run costs nothing.

## Using it

1. Choose a preset or type an activity, add 3 to 5 places, press **Compare places**.
2. Watch the research room. A first look appears in about a minute; deep research replaces it as each place finishes. Each finished place is re-read live, searched for missing fees, and double-checked by Gemini.
3. Read the verdict, then the scorecards, the checks, and the matrix. Use **Copy as Markdown** to hand it on.
4. **Saved live runs** open two real comparisons instantly. Their gap-filling and Gemini checks are baked in, so opening one never spends credits.

If a comparison is running and you close the tab, reopening it resumes the research. A finished comparison is not stored in the browser.

## Deploy (Vercel)

```bash
npx vercel link                                  # once
npx vercel env add TINYFISH_API_KEY production --sensitive
npx vercel env add GEMINI_API_KEY production --sensitive
npx vercel env add ACCESS_CODE production --sensitive      # recommended: the app spends paid credits
npx vercel deploy --prod
```

The API routes are set to 60 seconds (`maxDuration`), which fits Vercel's limits. Nothing is stored server-side, so there is no database to provision. Pages included for a real launch: `/privacy`, `/terms`, a branded 404, error boundaries, `robots.txt`, `sitemap.xml`, a web manifest and `/.well-known/security.txt`.

## Security

Summary (details and honest limits in [SECURITY.md](SECURITY.md)):

- Keys stay in server environment variables, never in the browser, logs or git. The history was scanned before publishing.
- Every API route is POST-only, same-origin only, size-capped, strictly validated, rate-limited per IP, and wrapped in an error boundary that returns generic messages. An optional passcode (`ACCESS_CODE`) and a daily run budget protect the paid APIs.
- Web and model output is untrusted: fields are bounded, only `http(s)` links are rendered, page text sent to Gemini is labelled untrusted, and gap-filled figures need a verified quote.
- Browser hardening: a Content Security Policy with no third-party origins, HSTS, `nosniff`, no framing, strict referrer and permissions policies.
- Dependencies are audited (`npm audit --omit=dev` reports 0 vulnerabilities at the time of writing); run it before each release.
- Known limit: the rate limiter is in memory (per instance). For a hard guarantee use `ACCESS_CODE` and/or a Vercel Firewall rate-limit rule.

## Project layout

```
app/                 page.tsx (composition), layout.tsx, globals.css (the one theme),
                     privacy/, terms/, not-found, error, robots, sitemap, manifest
  api/start          search + launch research and quick read per place; fails fast on a bad key
  api/poll           status, live activity, quick-read preview, final report with live page check
  api/fill           find missing fees and times on a second official page, verified
  api/verify         Gemini double-check for one place
  api/summarize      totals, USD conversion, FX cross-check, recommendation
  api/unlock, config optional access code
components/          Hero, Nav, RunRoom (the wait), About, Unlock, Shell, ui primitives, results/*
lib/                 logic (parsing, checks, scoring), fill, gemini, fx, tf (TinyFish client),
                     guard + api + validate (the security layer), activity, progress, export,
                     useComparison (state hook), selftest
public/demos/        two saved live runs (gap-filling and Gemini checks baked in)
scripts/             demo.mjs (record a live run), enrich.mjs (bake the finishing passes into a saved run)
```

## Scripts

```bash
npm run dev          # develop
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run selftest     # offline checks of the logic (no network, no keys)
node scripts/demo.mjs "<activity>" "<place>" "<place>" "<place>"   # against a running `next start`; saves to public/demos
node scripts/enrich.mjs public/demos/<file>.json                   # bake gap filling + Gemini into a saved run
```

## Limits worth knowing

- The page check shows a quote is on the cited page; Gemini checks the figures against it. Neither proves a requirement is relevant to your exact business. Confirm with a local professional.
- Some official PDFs and regulators live on non-`.gov` hosts and show a "Check host" badge.
- Research quality varies by place. Gaps the gap-filler cannot back with a verified quote stay gaps, and what it finds can differ slightly from run to run.
- Official fee pages are often forms or PDFs, so the gap-filler fills only a minority of missing fees (a few out of a dozen on typical runs).
- Google Search grounding returned a quota error on the test key, so Gemini is used for verification only, not for live lookups.

## Credits

The hero is a remix of "Hero Intro Animation" by Yahia Bakour ([@mynameisyahia](https://x.com/i/status/2083110817055306161)), lookap entry `5h6d0-hero-intro-animation`: its layout and proportions, spacing, the card over a liquid surface, and the timing of the typed placeholder and the water (swells fastest around 1.5 to 2 s, frozen from 4.5 s). Copy, colours, fonts, icons and data are this project's own. The credit is also in a comment at the top of `components/Hero.tsx` and `components/WaterShader.tsx`.

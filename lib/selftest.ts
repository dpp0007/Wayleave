import { applyGemini, costOnPage, excerptFor, summarise, supportedCost, isOfficial, parseJson, recommend, totals, verifyText } from "./logic";
import assert from "node:assert";
import { activityOf } from "./activity";
import { toMarkdown } from "./export";
import { clock, minutesLeft, overallProgress, placeProgress, stepOf } from "./progress";
import { fxRow } from "./fx";
import { toItem } from "./gemini";
import { TFError, explain } from "./tf";
import { buildScript, scriptEnd, textAt } from "./typeScript";

assert.equal(verifyText("Fee is $200 per year", "The licence fee is $200 per year, payable..."), "exact");
assert.equal(verifyText("fee 200 per year licence", "licence fee: 200 per year"), "fuzzy");
assert.equal(verifyText("totally different words here", "licence fee 200"), "missing");
assert.ok(isOfficial("https://www.sfa.gov.sg/x") && isOfficial("https://www.gov.uk/y") && !isOfficial("https://legalzoom.com"));
assert.deepEqual(parseJson('t ```json\n{"items":[1]}\n``` x'), { items: [1] });
const t = totals([{ cost: { min: 10, max: 20, currency: "SGD" }, time_days: { min: 1, max: 5 } }, { cost: {}, time_days: {} }]);
assert.equal(t.cost_max, 20); assert.equal(t.cost_items_unknown, 1); assert.equal(t.time_max_days, 5);
const mk = (place: string, usd_max: any, time_max_days: any, steps: any, confidence: number, level = "full") =>
  ({ place, level, items: [1], summary: { usd_max, time_max_days, steps, confidence, gaps: 0, items_unknown: { cost: usd_max == null ? 1 : 0, time: time_max_days == null ? 1 : 0 } } });
const r = recommend([mk("A", 100, 10, 3, 0.9), mk("B", 900, 60, 8, 0.9), mk("C", null, null, null, 0.1), mk("D", 1, 1, 1, 1, "failed")]);
assert.equal(r.ranking[0].place, "A");
assert.ok(r.text.some((x) => x.includes("Not assessed") && x.includes("D")));
assert.ok(r.text.some((x) => x.startsWith("C: ") && x.includes("not scored")));
// mostly-unstated fees must not win on cost
const g = recommend([{ ...mk("P", 10, 5, 4, 0.5), summary: { ...mk("P", 10, 5, 4, 0.5).summary, items_unknown: { cost: 3, time: 0 } } }, mk("Q", 500, 5, 4, 0.5), mk("R", 600, 5, 4, 0.5)]);
assert.ok(g.ranking.find((x) => x.place === "P")!.missing.includes("cost"));
// near-JSON repair: unescaped inner quotes + trailing comma
const bad = ["```json", "{", '  "items": [', "    {", '      "evidence": "must register with the Authority ("FTA") on EmaraTax",', '      "name": "x",', "    }", "  ],", '  "gaps": [', '    "a "quoted" gap",', '    "b"', "  ]", "}", "```"].join("\n");
const pj = parseJson(bad);
assert.equal(pj.items[0].evidence, 'must register with the Authority ("FTA") on EmaraTax'); assert.equal(pj.gaps[0], 'a "quoted" gap');
// recurring items are excluded from start-up totals
const tt = totals([{ kind: "licence", cost: { min: 5, max: 5, currency: "USD" }, time_days: { min: 2, max: 3 } }, { kind: "ongoing", cost: { min: 9, max: 9, currency: "USD" }, time_days: { min: 365, max: 365 } }]);
assert.equal(tt.cost_max, 5); assert.equal(tt.time_max_days, 3);
// a fee must appear as an amount: "36 months" is not a S$36 fee (found by spot-check), but "$33 per storey" is
assert.equal(costOnPage(36, "validity is for a period of 36 months unless otherwise stated"), false);
assert.equal(costOnPage(33, "Non-Residential | 33 (Fee per storey ($))"), true);
assert.equal(costOnPage(1905, "Premises licence band E £1,905.00 per year"), true);
assert.equal(costOnPage(20, "a 20% surcharge applies"), false);
assert.equal(costOnPage(5, "fee is $15"), false);
const pg = "Non-Residential | 33 (Fee per storey ($)). valid for 36 months";
assert.deepEqual(supportedCost({ min: 33, max: 36, currency: "SGD" }, pg), { min: 33, max: 33, currency: "SGD" }); // the spot-check miss
assert.deepEqual(supportedCost({ min: 36, max: 36, currency: "SGD" }, pg), { min: null, max: null, currency: "SGD" });
assert.equal(supportedCost({ min: 33, max: 33, currency: "SGD" }, pg), null);
// hero typing timeline matches the measured moments of the original clip (st@0.5, first full by 1.5 and held, 4 chars @3.75, 3 chars @4.25)
const sc = buildScript("st", "linear.app", 4, "notion.com");
assert.equal(textAt(sc, 0.5), "st"); assert.equal(textAt(sc, 0.8), "l"); assert.equal(textAt(sc, 1.1), "linea");
assert.equal(textAt(sc, 1.5), "linear.app"); assert.equal(textAt(sc, 3.4), "linear.app");
assert.equal(textAt(sc, 3.75), "line"); assert.equal(textAt(sc, 4.0), ""); assert.equal(textAt(sc, 4.25), "not");
assert.equal(textAt(sc, 4.6), "notion."); assert.equal(textAt(sc, 5.0), "notion.com"); assert.equal(textAt(sc, 99), "notion.com");
assert.ok(scriptEnd(sc) < 5.4);
// users see a plain-language reason, never a raw error code
assert.ok(explain(new TFError(401, "INVALID_API_KEY", "")).includes(".env.local"));
assert.ok(explain(new TFError(402, "INSUFFICIENT_CREDITS", "")).includes("wallet"));
assert.equal(explain(new TFError(500, "WEIRD", "")), "WEIRD");
// excerpt: the reader sees the text around the claimed number, not the whole page
const page = "Intro text. ".repeat(60) + "Non-Residential | 33 (Fee per storey ($)). Validity is 36 months." + " Outro. ".repeat(60);
const ex = excerptFor({ cost: { min: 33, max: 33 } }, page);
assert.ok(ex.includes("33 (Fee per storey") && ex.length <= 900);

// Gemini verdicts: a fix is accepted only if the corrected number is in the source text; otherwise the fee is dropped, never guessed
const item = { name: "Fire Certificate", cost: { min: 36, max: 36, currency: "SGD" }, evidence: "33 (Fee per storey ($)). validity 36 months", excerpt: ex };
const g1 = applyGemini([item], { 0: { verdict: "unsupported", cost_ok: false, currency_ok: true, time_ok: true, note: "36 is a validity period", fix_cost: { min: 33, max: 33, currency: "SGD" } } })[0];
assert.deepEqual(g1.cost, { min: 33, max: 33, currency: "SGD" }); assert.equal(g1.cost_corrected, true); assert.equal(g1.cost_unsupported.max, 36);
const g2 = applyGemini([item], { 0: { verdict: "unsupported", cost_ok: false, currency_ok: true, time_ok: true, note: "x", fix_cost: { min: 99, max: 99, currency: "SGD" } } })[0];
assert.equal(g2.cost.max, null); assert.ok(!g2.cost_corrected); // 99 is not in the text, so it is not accepted
assert.equal(applyGemini([item], {})[0], item); // no verdict: untouched
const g3 = applyGemini([{ ...item, cost: { min: 33, max: 33, currency: "USD" } }], { 0: { verdict: "partly", cost_ok: true, currency_ok: false, time_ok: true, note: "$ on a Singapore page is SGD" } })[0];
assert.equal(g3.currency_unsure, true);
assert.equal(totals([g3]).cost_items_unknown, 1); // an item whose currency is in doubt is not summed into totals

// FX cross-check: independent sources agreeing is ok, disagreeing is flagged, one source cannot be cross-checked
assert.equal(fxRow("SGD", [{ name: "a", per_usd: 1.2829 }, { name: "b", per_usd: 1.2810 }, { name: "c", per_usd: 1.2816 }]).status, "ok");
assert.equal(fxRow("SGD", [{ name: "a", per_usd: 1.28 }, { name: "b", per_usd: 1.40 }]).status, "diverge");
assert.equal(fxRow("AED", [{ name: "a", per_usd: 3.6725 }]).status, "single_source");
// live activity feed from a running research run's working state
const act = activityOf({ iterations: 3, research_plan: { summary: "Round 3: fees", subquestions: [{ question: "What is the fee?" }] },
  evidence: [{ url: "https://www.sfa.gov.sg/a", title: "SFA", claims: [{}, {}] }, { url: "https://www.gov.uk/b", title: "GOV.UK", claims: [{}] }] });
assert.equal(act!.sourceCount, 2); assert.equal(act!.claims, 3); assert.equal(act!.sources[0].domain, "gov.uk"); assert.equal(act!.questions[0], "What is the fee?");
assert.equal(activityOf(null), null); assert.equal(activityOf({ evidence: [] }), null);
// Gemini rows: fix amounts arrive as strings, empty means no fix, junk is rejected
assert.deepEqual(toItem({ verdict: "unsupported", cost_ok: false, currency_ok: true, time_ok: true, note: "n", fix_min: "33", fix_max: "33.00", fix_currency: "sgd" }).fix_cost, { min: 33, max: 33, currency: "SGD" });
assert.equal(toItem({ verdict: "supported", cost_ok: true, currency_ok: true, time_ok: true, note: "n", fix_min: "", fix_max: "", fix_currency: "" }).fix_cost, null);
assert.equal(toItem({ verdict: "partly", cost_ok: false, currency_ok: true, time_ok: true, note: "n", fix_min: "abc", fix_max: "1,905", fix_currency: "dollars" }).fix_cost!.currency, null);
// progress: moves while deep research runs, never claims 100% before the work is done, steps follow the real order
const base: any = { place: "A", seeds: [], notes: [], researchId: "r", agentId: "a", startedAt: 0, stage: 2, done: false, previewSent: false };
assert.ok(placeProgress(base, 60_000) < placeProgress(base, 240_000) && placeProgress(base, 240_000) <= 0.88);
assert.ok(placeProgress({ ...base, activity: { sourceCount: 30 } }, 60_000) > placeProgress(base, 60_000)); // reading more pages moves the bar
assert.equal(placeProgress({ ...base, done: true }, 1), 1); assert.ok(placeProgress({ ...base, done: true, gemini: "pending" }, 1) < 1);
assert.equal(stepOf({ ...base, stage: 1 }), 1); assert.equal(stepOf({ ...base, done: true, gemini: "pending" }), 4); assert.equal(stepOf({ ...base, done: true, gemini: "done" }), 5);
assert.equal(minutesLeft(0.5, 100_000), null); assert.equal(minutesLeft(0.1, 400_000), null); assert.equal(minutesLeft(0.5, 240_000), 4);
assert.equal(clock(125_000), "2:05"); assert.equal(overallProgress([], 0), 0);

// markdown export keeps every row's source link and the honest caveats
const md = toMarkdown({ places: [{ place: "Singapore", summary: { cost_min: 195, cost_max: 195, currency: "SGD", usd_min: 152, usd_max: 152, time_max_days: 5, steps: 1, verified: 1 },
  items: [{ name: "Food Shop Licence", kind: "licence", cost: { min: 195, max: 195, currency: "SGD" }, time_days: {}, source_url: "https://www.sfa.gov.sg/x", checked_at: "2026-11-09" }], gaps: ["Time not stated"] }],
  recommendation: { headline: "Singapore", provisional: true, ranking: [], points: [{ tone: "warn", text: "Close call." }], text: [] }, fx: { ok: true, asof: "2026-11-09", rows: [{ currency: "SGD", per_usd: 1.28, sources: [{ name: "a", per_usd: 1.28 }, { name: "b", per_usd: 1.28 }], max_dev_pct: 0, status: "ok" }] } } as any, "open a cafe", "2026-11-09");
assert.ok(md.includes("[Source](https://www.sfa.gov.sg/x)") && md.includes("Provisional: Singapore") && md.includes("not legal advice") && md.includes("- Time not stated") && md.includes("1 USD = 1.28 SGD"));
// a thin quick-read place (2 steps) must not win over deep-researched places; if everything is quick, ranking still works (provisional)
const mq = (place: string, usd_max: any, d: any, steps: any, c: number, level: string) => ({ place, level, items: [1], summary: { usd_max, time_max_days: d, steps, confidence: c, gaps: 0, items_unknown: { cost: 0, time: 0 } } });
const rq = recommend([mq("Deep1", 500, 30, 9, 0.6, "full"), mq("Deep2", 700, 40, 10, 0.6, "full"), mq("Thin", 0, 28, 2, 0.17, "quick")]);
assert.notEqual(rq.ranking[0].place, "Thin"); assert.ok(!rq.ranking.some((x) => x.place === "Thin")); assert.ok(rq.text.some((x) => x.startsWith("Thin:") && x.includes("too thin")));
assert.equal(recommend([mq("Q1", 100, 5, 2, 0.3, "quick"), mq("Q2", 200, 9, 3, 0.3, "quick")]).ranking.length, 2);
// cost breakdown: priced steps biggest first, unpriced steps named, recurring items left out; small USD amounts keep their decimals
const sm = summarise({ items: [
  { name: "Reg", kind: "registration", cost: { min: 40, max: 40, currency: "INR" }, time_days: {} },
  { name: "Licence", kind: "licence", cost: { min: 100, max: 1000, currency: "INR" }, time_days: {} },
  { name: "NOC", kind: "inspection", cost: {}, time_days: {} },
  { name: "Return", kind: "ongoing", cost: { min: 500, max: 500, currency: "INR" }, time_days: {} } ], gaps: [] }, { INR: 94 });
assert.deepEqual(sm.priced_items.map((x: any) => x.name), ["Licence", "Reg"]); assert.deepEqual(sm.unpriced_items.map((x: any) => x.name), ["NOC"]);
assert.equal(sm.usd_min, 1.49); assert.equal(sm.usd_max, 11.06); // 140-1,040 INR at 94 per USD
console.log("selftest ok");

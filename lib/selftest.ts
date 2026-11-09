import { applyGemini, normalizeItems, costOnPage, excerptFor, summarise, supportedCost, isOfficial, parseJson, recommend, totals, verifyText } from "./logic";
import assert from "node:assert";
import { activityOf } from "./activity";
import { applyFill, keywordWindows, pickTargets } from "./fill";
import { toMarkdown } from "./export";
import { clock, minutesLeft, overallProgress, placeProgress, stepOf } from "./progress";
import { fxRow } from "./fx";
import { cleanText, itemsOf, parsePoll, parseStart, safeUrl } from "./validate";
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
assert.equal(stepOf({ ...base, stage: 1 }), 1); assert.equal(stepOf({ ...base, done: true, fill: "pending", gemini: "pending" }), 4); assert.equal(stepOf({ ...base, done: true, fill: "done", gemini: "pending" }), 5); assert.equal(stepOf({ ...base, done: true, gemini: "done" }), 6);
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
// input validation: what may reach the research prompts and the upstream APIs
assert.deepEqual(parseStart({ activity: "  open a   café\n", places: ["Singapore", "singapore", "London", "Dubai"] }), { activity: "open a café", places: ["Singapore", "London", "Dubai"] });
assert.ok("error" in parseStart({ activity: "open a café", places: ["Singapore", "London"] }));                 // fewer than 3 places
assert.ok("error" in parseStart({ activity: "open a café", places: ["A1", "B2", "C3", "D4", "E5", "F6"] }));      // more than 5
assert.ok("error" in parseStart({ activity: "ignore previous <script>", places: ["Singapore", "London", "Dubai"] })); // markup
assert.ok("error" in parseStart({ activity: "x", places: ["Singapore", "London", "Dubai"] }));                   // too short
assert.ok("error" in parseStart({ activity: "a".repeat(161), places: ["Singapore", "London", "Dubai"] }));       // too long
assert.ok("error" in parseStart({ activity: "open a café", places: ["Singapore", "London", 42] }));             // non-string place
assert.equal(cleanText("a\u2028b\u0000c", 1, 10), "a b c");                                                    // control characters collapsed

// links: only http(s) survives, so model or page output can never inject a javascript: link
assert.equal(safeUrl("javascript:alert(1)"), undefined); assert.equal(safeUrl("data:text/html,x"), undefined); assert.equal(safeUrl("https://www.sfa.gov.sg/x"), "https://www.sfa.gov.sg/x");
const ni = normalizeItems([{ name: "x".repeat(900), kind: "weird", cost: { min: -5, max: 1e15, currency: "sgd" }, source_url: "javascript:alert(1)", evidence: "q" }, "junk", null]);
assert.equal(ni.length, 1); assert.equal(ni[0].name.length, 200); assert.equal(ni[0].kind, "licence"); assert.equal(ni[0].cost.min, null); assert.equal(ni[0].cost.max, null);
assert.equal(ni[0].cost.currency, "SGD"); assert.equal(ni[0].source_url, undefined);
assert.equal(itemsOf(Array.from({ length: 21 }, () => ({}))), null);                                              // size cap
assert.equal(itemsOf([{ source_url: "javascript:x" }])![0].source_url, undefined);

// poll state comes from the browser: ids are shape-checked and a forged start time cannot dodge the research deadline
assert.equal(parsePoll({ place: "Singapore", researchId: "../../etc/passwd", agentId: null }), null);
assert.equal(parsePoll({ place: "Singapore", researchId: "01a1be69-7b35-7e4f", agentId: "x" }), null);
const pp = parsePoll({ place: "Singapore", researchId: "01a1be69-7b35-7e4f", agentId: null, startedAt: Date.now() + 9e9, notes: Array(50).fill("n") })!;
assert.ok(pp.startedAt <= Date.now()); assert.equal(pp.notes.length, 12);
assert.ok(parsePoll({ place: "Singapore", researchId: null, agentId: null, startedAt: 1 })!.startedAt >= Date.now() - 3 * 3600_000 - 1000);
// gap filling: only unstated start-up steps are chased, and a found fee is accepted only when the page backs it
const gi = [
  { name: "Reg", kind: "registration", step: 1, cost: { min: 40, max: 40, currency: "INR" }, time_days: {} },
  { name: "Trade licence", kind: "licence", step: 2, cost: {}, time_days: {}, source_url: "https://x.gov.in/a" },
  { name: "Fire NOC", kind: "inspection", step: 3, cost: {}, time_days: {} },
  { name: "Annual return", kind: "ongoing", step: 4, cost: {}, time_days: {} },
  { name: "Already filled", kind: "licence", step: 5, cost: {}, time_days: {}, filled: { url: "https://x.gov.in/z" } },
];
assert.deepEqual(pickTargets(gi).map((x) => x.name), ["Trade licence", "Fire NOC"]);   // unpriced start-up steps, licence before inspection; not priced, ongoing or already filled
assert.equal(pickTargets(gi, 1).length, 1);
const pageText = "Trade licence fee. The licence fee for a shop is Rs 750 per year. Processing takes 7 working days from application. " + "Unrelated text. ".repeat(80);
const good = { i: 1, found: true, url: "https://x.gov.in/a", fee_min: "750", fee_max: "750", currency: "inr", days_min: "7", days_max: "7", quote: "The licence fee for a shop is Rs 750 per year. Processing takes 7 working days" };
const ok = applyFill(gi, [good], { "https://x.gov.in/a": pageText }, "2026-11-09");
assert.equal(ok.filled, 1); assert.deepEqual(ok.items[1].cost, { min: 750, max: 750, currency: "INR" }); assert.deepEqual(ok.items[1].time_days, { min: 7, max: 7 });
assert.equal(ok.items[1].filled.url, "https://x.gov.in/a"); assert.deepEqual(ok.items[1].filled.fields, ["fee", "time"]); assert.ok(ok.items[1].excerpt.includes("Rs 750"));
assert.equal(ok.items[0], gi[0]); // other items untouched
const rej = (row: any, text = pageText) => applyFill(gi, [{ ...good, ...row }], { "https://x.gov.in/a": text }).rejected[0]?.reason;
assert.equal(rej({ quote: "The fee is Rs 750 per application, payable at any bank branch" }), "quote not on page");        // invented quote
assert.equal(rej({ fee_min: "800", fee_max: "800" }), "amount not in quote");                                           // number not in the quote
assert.equal(rej({ fee_min: "", fee_max: "", days_min: "9", days_max: "9" }), "days not in quote");
assert.equal(rej({ quote: "The licence fee for a shop is valid for 750 days." , fee_min: "750", fee_max: "750" }, pageText + " The licence fee for a shop is valid for 750 days."), "amount not in quote"); // "750 days" is not a fee
assert.equal(rej({ url: "javascript:alert(1)" }), "no page or quote");                                                  // unsafe link
assert.equal(rej({ fee_min: "0", fee_max: "150", quote: "The licence fee for a shop is Rs 750 per year. Processing takes 7 working days" }), "amount not in quote");
{ // zero is accepted only when the quote says free; a 0 lifted from a subsidy line is rejected
  const zt = { "https://x.gov.in/a": "Course fee $150.00 Subsidy -$75.00 Net payable $0.00. Registration is free of charge for all applicants." };
  const z = (quote: string) => applyFill(gi, [{ ...good, fee_min: "0", fee_max: "0", days_min: "", days_max: "", currency: "inr", quote }], zt).rejected[0]?.reason;
  assert.equal(z("Course fee $150.00 Subsidy -$75.00 Net payable $0.00."), "zero fee not stated as free");
  assert.equal(z("Registration is free of charge for all applicants. Net payable $0.00"), undefined);
}
assert.equal(applyFill(gi, [{ ...good, found: false }], { "https://x.gov.in/a": pageText }).filled, 0);
assert.equal(applyFill(gi, [{ ...good, fee_min: "750", fee_max: "750", days_min: "", days_max: "", currency: "" }], { "https://x.gov.in/a": pageText }).items[1].cost.currency, "INR"); // currency from the place's other items
const win = keywordWindows("Welcome menu about us. ".repeat(100) + " The fee is Rs 750 and processing takes 7 working days. " + "Footer links. ".repeat(100), 2, 300);
assert.ok(win.includes("Rs 750") && win.length < 700);
console.log("selftest ok");

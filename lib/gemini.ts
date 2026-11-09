// Gemini second opinion on the figures the research model extracted. Server-side only; the key never reaches the browser.
//
// What it can and cannot do: it judges each claimed fee, currency and processing time against the quoted evidence and the page
// excerpt we fetched live. It does NOT look up exchange rates (Google Search grounding is not available on every key, and a model
// answering from memory would be guessing), so FX is cross-checked against independent live sources in lib/fx.ts instead.

export type Verdict = "supported" | "partly" | "unsupported";
export type GeminiItem = { verdict: Verdict; cost_ok: boolean; currency_ok: boolean; time_ok: boolean; note: string; fix_cost?: { min: number | null; max: number | null; currency: string | null } | null };
type GeminiResult = { ok: boolean; model?: string; byIndex?: Record<number, GeminiItem>; reason?: string };

/** Accepts the standard names and the project's existing `Gemni_API` spelling. */
function geminiKey(): string | undefined {
  const env = process.env;
  return env.GEMINI_API_KEY || env.GOOGLE_API_KEY || Object.entries(env).find(([k, v]) => v && /^gem[a-z]*_?(api|key)/i.test(k))?.[1];
}

// Order matters: fast and accurate first. Models get retired for new accounts, so each failure falls through to the next.
const models = () => [process.env.GEMINI_MODEL, "gemini-3.1-flash-lite", "gemini-3.5-flash"].filter((m): m is string => !!m);

const SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      i: { type: "INTEGER" },
      verdict: { type: "STRING", enum: ["supported", "partly", "unsupported"] },
      cost_ok: { type: "BOOLEAN" }, currency_ok: { type: "BOOLEAN" }, time_ok: { type: "BOOLEAN" },
      note: { type: "STRING" },
      // flat strings on purpose: a nested nullable number object made the model ramble digits. Empty string means "no fix".
      fix_min: { type: "STRING" }, fix_max: { type: "STRING" }, fix_currency: { type: "STRING" },
    },
    required: ["i", "verdict", "cost_ok", "currency_ok", "time_ok", "note", "fix_min", "fix_max", "fix_currency"],
  },
};

const amount = (v: unknown) => { const n = parseFloat(String(v ?? "").replace(/,/g, "")); return Number.isFinite(n) && n >= 0 ? n : null; };

/** Raw model row -> GeminiItem (fix fields parsed from strings; no fix when both amounts are empty). */
export function toItem(v: any): GeminiItem {
  const min = amount(v.fix_min), max = amount(v.fix_max);
  const cur = /^[A-Za-z]{3}$/.test(String(v.fix_currency ?? "").trim()) ? String(v.fix_currency).trim().toUpperCase() : null;
  return { verdict: v.verdict, cost_ok: !!v.cost_ok, currency_ok: !!v.currency_ok, time_ok: !!v.time_ok, note: String(v.note ?? "").slice(0, 240),
    fix_cost: min == null && max == null ? null : { min, max, currency: cur } };
}

const INSTRUCTIONS = `You are a meticulous fact-checker for government licence data. Each item has CLAIMED figures and the SOURCE TEXT they were taken from (a verbatim quote plus an excerpt of the official page). Judge ONLY from the source text; never use outside knowledge to fill in or correct a number.
- cost_ok: the claimed min/max appear in the text as a fee for THIS item. Not ok if the number is a validity period, quantity, percentage, deadline, or another item's fee. A per-unit fee (per storey, per year) is ok; say so in the note.
- currency_ok: the claimed currency matches the currency the text names or implies (S$ or $ on a Singapore government page = SGD, £ = GBP, Dhs = AED, Rs/₹ = INR, a bare $ on a US page = USD). If the text names no currency, return true only when it is the place's national currency and say it was inferred. A bare $ is ambiguous: be strict.
- time_ok: the claimed processing time matches the text (null claims are ok).
- verdict: supported (all claimed figures check out), partly (some do), unsupported (the text does not back the figures).
- fix_min / fix_max / fix_currency: only when the text clearly states a different amount or currency (plain digits, 3-letter ISO code); otherwise empty strings.
- note: one short sentence, plain English.
Return one entry per item, using the given i.`;

async function ask(model: string, prompt: string, timeoutMs: number) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST", signal: AbortSignal.timeout(timeoutMs),
    headers: { "x-goog-api-key": geminiKey()!, "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: INSTRUCTIONS }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0 },
    }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${r.status} ${j?.error?.status ?? ""}`.trim());
  const text = j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
  return JSON.parse(text);
}

type CheckInput = { i: number; name: string; cost: any; time_days: any; evidence?: string; excerpt?: string };

export async function geminiVerify(place: string, items: CheckInput[]): Promise<GeminiResult> {
  if (!geminiKey()) return { ok: false, reason: "no Gemini key configured" };
  if (!items.length) return { ok: true, model: "-", byIndex: {} };
  const prompt = `Place: ${place}\n\nITEMS:\n` + items.map((x) => JSON.stringify({
    i: x.i, name: x.name, claimed_cost: x.cost, claimed_time_days: x.time_days, quote: x.evidence ?? "", page_excerpt: (x.excerpt ?? "").slice(0, 900),
  })).join("\n");
  let last = "no model answered";
  for (const [n, model] of models().entries()) {
    try {
      const arr = await ask(model, prompt, [30000, 22000][n] ?? 12000);
      if (!Array.isArray(arr)) throw new Error("bad shape");
      return { ok: true, model, byIndex: Object.fromEntries(arr.map((v: any) => [v.i, toItem(v)])) };
    } catch (e) { last = `${model}: ${(e as Error).message}`; }
  }
  return { ok: false, reason: last };
}

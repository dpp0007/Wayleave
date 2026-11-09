// Thin TinyFish client. Retries transient failures (429/5xx/network) with backoff; never throws on parse noise.
export class TFError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
/** Plain-language reason for a TinyFish failure, shown to users instead of raw error codes. */
export function explain(e: unknown): string {
  const code = e instanceof TFError ? e.code : "";
  return ({
    INVALID_API_KEY: process.env.NODE_ENV === "production" ? "the research service is temporarily unavailable" : "TinyFish rejected the API key. Check TINYFISH_API_KEY in .env.local and restart the server",
    INSUFFICIENT_CREDITS: "the TinyFish free allowance is used up and the wallet is empty. Add funds or wait for the daily reset",
    FORBIDDEN: "this TinyFish account does not have Research enabled",
    RATE_LIMIT_EXCEEDED: "TinyFish rate limit or the 5-run concurrency cap was reached. Try again in a minute",
    NETWORK: "TinyFish could not be reached. Check the connection",
  } as Record<string, string>)[code] ?? (code || String((e as Error)?.message ?? e));
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function call(method: string, url: string, body?: unknown, retries = 2, timeout = 40000): Promise<any> {
  for (let n = 0; ; n++) {
    try {
      const r = await fetch(url, {
        method, signal: AbortSignal.timeout(timeout),
        headers: { "X-API-Key": process.env.TINYFISH_API_KEY || "", "Content-Type": "application/json", "User-Agent": "wayleave/2.0" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await r.text();
      let j: any = {};
      try { j = text ? JSON.parse(text) : {}; } catch { /* non-JSON body */ }
      if (r.ok) return j;
      if ([429, 502, 503, 504].includes(r.status) && n < retries) {
        await sleep(Math.min(6000, (Number(r.headers.get("retry-after")) || 2) * 1000 * (n + 1)));
        continue;
      }
      throw new TFError(r.status, j?.error?.code ?? "ERROR", j?.error?.message ?? text.slice(0, 200));
    } catch (e) {
      if (e instanceof TFError) throw e;
      if (n < retries) { await sleep(1000 * (n + 1)); continue; }
      throw new TFError(0, "NETWORK", String(e));
    }
  }
}

export const search = async (query: string, includeDomains: string[] = []) =>
  (await call("GET", "https://api.search.tinyfish.ai?" + new URLSearchParams({ query, ...(includeDomains.length ? { include_domains: includeDomains.join(",") } : {}) }))).results ?? [];

export const fetchPages = (urls: string[], perUrlMs = 20000) =>
  call("POST", "https://api.fetch.tinyfish.ai", {
    urls: urls.slice(0, 10), format: "markdown", ttl: 0, per_url_timeout_ms: perUrlMs,
    purpose: "Verify a quoted government requirement appears on the cited official page",
  }, 1, 55000);

export const researchStart = async (query: string, domains: string[]): Promise<string> =>
  (await call("POST", "https://agent.tinyfish.ai/v1/automation/run-research-async", {
    query, mode: "deep",
    ...(domains.length ? { domain_filter: { mode: "include", domains: domains.slice(0, 20), block: [] } } : {}),
  })).research_run_id;
export const researchGet = (id: string) => call("GET", `https://agent.tinyfish.ai/v1/research-run/${id}`);
export const researchCancel = (id: string) => call("POST", `https://agent.tinyfish.ai/v1/research-run/${id}/cancel`, {}, 0, 10000).catch(() => null);

export const agentStart = async (url: string, goal: string): Promise<string> =>
  (await call("POST", "https://agent.tinyfish.ai/v1/automation/run-async", { url, goal })).run_id;
export const agentGet = (id: string) => call("GET", `https://agent.tinyfish.ai/v1/runs/${id}`);

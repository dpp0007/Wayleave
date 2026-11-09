import { NextResponse } from "next/server";
import { type Route, fail, guard, noStore } from "./guard";

/**
 * Wraps an API handler with the guard (origin, size, access code, rate limit), bounded JSON parsing, and an error boundary that
 * never leaks internals: upstream error text, stack traces and keys stay in the server log (truncated), users get a plain message.
 */
export function api(route: Route, handle: (body: any) => Promise<Response | object>, opts: { maxBytes?: number; access?: boolean } = {}) {
  const maxBytes = opts.maxBytes ?? 200_000;
  return async (req: Request): Promise<Response> => {
    const blocked = guard(req, route, { maxBytes, access: opts.access ?? true });
    if (blocked) return blocked;
    let body: any = {};
    try {
      const text = await req.text();
      if (text.length > maxBytes) return fail(413, "Request too large.");
      body = text ? JSON.parse(text) : {};
    } catch { return fail(400, "Invalid request."); }
    try {
      const out = await handle(body);
      return out instanceof Response ? out : NextResponse.json(out, { headers: noStore });
    } catch (e) {
      console.error(`[api/${route}]`, String((e as Error)?.message ?? e).slice(0, 200));
      return fail(500, "Something went wrong. Please try again.");
    }
  };
}

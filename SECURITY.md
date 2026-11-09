# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for a security problem. Use GitHub's private reporting instead:
<https://github.com/dpp0007/Wayleave/security/advisories/new>

Include what you found, how to reproduce it, and the impact. You will get an acknowledgement, and fixes are credited if you wish.

## What is in place

**Secrets.** API keys live only in server environment variables (`TINYFISH_API_KEY`, `GEMINI_API_KEY`, optional `ACCESS_CODE`). They are never sent to the browser, never logged, and `.env*` files are git-ignored. The git history was scanned for key patterns before publishing.

**Every API route** (`lib/api.ts`, `lib/guard.ts`) is POST-only and goes through the same gate:
- same-origin only (`Origin` and `Sec-Fetch-Site` checks), so other sites cannot drive it from a visitor's browser;
- request size caps, and strict validation of every field (`lib/validate.ts`): length limits, plain text only, 3 to 5 places, ids shape-checked, client-held state clamped;
- per-IP rate limits per route, plus a daily budget of research runs (`MAX_RUNS_PER_DAY`, default 60);
- an optional shared passcode (`ACCESS_CODE`): constant-time comparison, HttpOnly, Secure, SameSite=Strict cookie, rate-limited attempts;
- an error boundary that returns a generic message. Upstream error text, stack traces and keys stay in the server log.

**Untrusted content.** Everything read from the web or returned by a model is treated as untrusted: fields are length-bounded, numbers must be finite, and only `http(s)` links are ever rendered or fetched (a `javascript:` link cannot reach the page). Page text sent to Gemini is labelled untrusted. A fee found later by the gap-filler is accepted only if its quote is on the cited page and the amount is in the quote.

**Server-side fetches** go only to fixed hosts (TinyFish, Google Gemini, three exchange-rate providers). User-supplied URLs are never fetched by this server; page fetching is delegated to TinyFish, which rejects private addresses.

**Browser hardening** (`next.config.mjs`): a Content Security Policy (everything is same-origin, no framing, no plugins), HSTS, `nosniff`, `X-Frame-Options: DENY`, a strict referrer policy, a locked-down Permissions-Policy, cross-origin isolation headers, `Cache-Control: no-store` on the API, and no `X-Powered-By`.

**Privacy.** No accounts, no database, no analytics, no tracking cookies. See `/privacy`.

## Known limits (be honest about them)

- The rate limiter is **in memory**, so it is per server instance. On serverless it is best effort and resets on cold starts. For a hard guarantee, set `ACCESS_CODE` and/or add a rate-limit rule in the Vercel Firewall.
- The CSP allows `'unsafe-inline'` for scripts and styles, which Next.js hydration and inline styles require. A nonce-based CSP would remove it.
- Results are informational and can be wrong or incomplete. They are checked against live pages and by a second model, but are not legal advice.

## Deploying safely

1. Set the secrets as **sensitive** environment variables on the host; never commit them.
2. Decide on abuse protection before sharing the URL: an `ACCESS_CODE`, a low `MAX_RUNS_PER_DAY`, a Vercel Firewall rate limit, and spend alerts on the TinyFish and Google accounts.
3. Rotate any key that was ever pasted into a chat, ticket or log.
4. Run `npm audit --omit=dev` and `npm run selftest` before each release.

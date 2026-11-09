import { existsSync, readFileSync } from "node:fs";

// Next.js never overrides a variable that is already set, so a stale TINYFISH_API_KEY in the shell or Windows
// environment silently beats .env.local. For this key, .env.local wins when it exists (local development only).
if (existsSync(".env.local")) {
  const m = readFileSync(".env.local", "utf8").match(/^TINYFISH_API_KEY=(.*)$/m);
  const key = m?.[1].trim().replace(/^["']|["']$/g, "");
  if (key) process.env.TINYFISH_API_KEY = key;
}

const dev = process.env.NODE_ENV !== "production";

// Content Security Policy. Everything the app loads is its own: fonts are self-hosted at build time, all requests go to the same
// origin, and nothing may frame it. 'unsafe-inline' is required by Next's hydration scripts and by inline style attributes;
// 'unsafe-eval' is allowed only in development (React refresh).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const security = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

/** @type {import('next').NextConfig} */
export default {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      { source: "/:path*", headers: security },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

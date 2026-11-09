import { existsSync, readFileSync } from "node:fs";

// Next.js never overrides a variable that is already set, so a stale TINYFISH_API_KEY in the shell or Windows
// environment silently beats .env.local. For this key, .env.local wins when it exists.
if (existsSync(".env.local")) {
  const m = readFileSync(".env.local", "utf8").match(/^TINYFISH_API_KEY=(.*)$/m);
  const key = m?.[1].trim().replace(/^["']|["']$/g, "");
  if (key) process.env.TINYFISH_API_KEY = key;
}

/** @type {import('next').NextConfig} */
export default {};

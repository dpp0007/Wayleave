import { api } from "@/lib/api";
import { accessCookie, accessRequired, codeMatches, fail, noStore } from "@/lib/guard";

// Optional shared passcode (ACCESS_CODE). When set, the expensive routes require the cookie minted here. Attempts are rate limited,
// the comparison is constant-time, and the cookie is HttpOnly, Secure and SameSite=Strict.
export const POST = api("unlock", async (b) => {
  if (!accessRequired()) return { ok: true };
  const attempt = typeof b?.code === "string" ? b.code.slice(0, 200) : "";
  if (!codeMatches(attempt)) return fail(401, "That code is not right.");
  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json", "Set-Cookie": accessCookie(), ...noStore } });
}, { maxBytes: 1_000, access: false });

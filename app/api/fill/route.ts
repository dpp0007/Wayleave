import { api } from "@/lib/api";
import { fillGaps } from "@/lib/fill";
import { fail } from "@/lib/guard";
import { cleanText, itemsOf } from "@/lib/validate";

export const maxDuration = 60;

// Finds missing fees and times on a second official page and verifies them. Never fatal: on any problem the items come back
// unchanged and the gaps stay gaps.
export const POST = api("fill", async (b) => {
  const place = cleanText(b?.place, 2, 80), items = itemsOf(b?.items);
  if (!place || !items) return fail(400, "Invalid request.");
  const r = await fillGaps(place, items);
  return { items: r.items, tried: r.tried, filled: r.filled, rejected: r.rejected, stats: r.stats, status: "done" };
}, { maxBytes: 400_000 });

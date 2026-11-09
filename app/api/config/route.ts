import { NextResponse } from "next/server";
import { accessRequired, noStore, unlocked } from "@/lib/guard";

// What the page needs to know before the first request: is a passcode required, and does this browser already hold it?
// Reveals no secret and no configuration beyond that one boolean pair.
export async function GET(req: Request) {
  return NextResponse.json({ accessRequired: accessRequired(), unlocked: unlocked(req) }, { headers: noStore });
}

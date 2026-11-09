import type { Activity } from "./activity";
import type { FxRow } from "./fx";

/** One place inside a running comparison. The server is stateless, so the browser carries everything a poll needs. */
export type PlaceState = {
  place: string; seeds: string[]; notes: string[]; researchId: string | null; agentId: string | null; startedAt: number;
  stage: number;                 // 0 finding pages, 1 quick read, 2 deep research (while pending)
  done: boolean; previewSent: boolean;
  report?: any; activity?: Activity | null;
  fill?: "pending" | "done" | "skipped"; fillStats?: { tried: number; filled: number };
  gemini?: "pending" | "done" | "unavailable"; geminiModel?: string; geminiNote?: string;
};

export type Job = { activity: string; startedAt: number; finishedAt?: number; places: PlaceState[] };

export type Point = { tone: "good" | "warn" | "bad"; text: string };
export type Recommendation = {
  ranking: { place: string; score: number; level: string; missing: string[] }[];
  headline: string; provisional: boolean; points: Point[]; text: string[];
};
export type Data = { places: any[]; recommendation: Recommendation; fx: { ok: boolean; asof: string; rows: FxRow[] } };

export const MIN_PLACES = 3, MAX_PLACES = 5;

export const LEVEL: Record<string, { label: string; tone: "ok" | "warn" | "bad" }> = {
  full: { label: "Deep research", tone: "ok" },
  partial: { label: "Partial (deadline)", tone: "warn" },
  quick: { label: "Quick read only", tone: "warn" },
  failed: { label: "Not assessed", tone: "bad" },
};

export const KINDS = ["registration", "licence", "inspection", "tax", "insurance", "ongoing"] as const;
export const KIND_LABEL: Record<string, string> = {
  registration: "Registration", licence: "Licences & permits", inspection: "Inspections", tax: "Tax", insurance: "Insurance", ongoing: "Recurring duties",
};

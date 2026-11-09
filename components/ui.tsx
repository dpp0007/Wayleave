import type { ReactNode } from "react";

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

const TONES = {
  neutral: "border border-line bg-sunk text-mut",
  accent: "bg-accent-soft text-accent",
  warm: "bg-warm-soft text-warm",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
} as const;
type Tone = keyof typeof TONES;

export function Badge({ tone = "neutral", children, title, className }: { tone?: Tone; children: ReactNode; title?: string; className?: string }) {
  return <span title={title} className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", TONES[tone], className)}>{children}</span>;
}

export function Card({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return <div id={id} className={cx("rounded-2xl border border-line bg-surface p-5", className)}>{children}</div>;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("text-xs font-semibold tracking-wide text-mut uppercase", className)}>{children}</div>;
}

export const button = {
  primary: "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-ink transition hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:hover:opacity-40 disabled:active:scale-100",
  ghost: "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line2 bg-surface px-4 text-sm font-medium text-ink transition hover:border-ink active:scale-[0.98] disabled:opacity-40",
} as const;

export function Spinner({ className }: { className?: string }) {
  return <span aria-hidden className={cx("inline-block size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent", className)} />;
}

/** Grey bar that shimmers while its content is still on the way. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("animate-shimmer rounded-md bg-[linear-gradient(90deg,var(--sunk)_25%,var(--line)_50%,var(--sunk)_75%)] bg-[length:200%_100%]", className)} />;
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><h2 className="text-2xl">{children}</h2>{aside}</div>;
}

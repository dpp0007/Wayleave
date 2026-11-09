"use client";
import { useEffect, useState } from "react";
import Brand from "./Brand";
import { cx } from "./ui";

// Links only point at sections that exist: "Results" appears once there is a comparison to show, so no link is ever dead.
const ALL = [["top", "Compare"], ["how", "How it works"], ["results", "Results"], ["samples", "Saved runs"]] as const;

const go = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  history.replaceState(null, "", id === "top" ? location.pathname : `#${id}`);
};

export default function Nav({ onCompare, onSample, hasSample, hasResults }: { onCompare: () => void; onSample: () => void; hasSample: boolean; hasResults: boolean }) {
  const LINKS = ALL.filter(([id]) => id !== "results" || hasResults);
  const [active, setActive] = useState("");
  const [raised, setRaised] = useState(false);

  // highlight the section in view; add a hairline once the page has scrolled
  useEffect(() => {
    const els = LINKS.map(([id]) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver((es) => {
      const vis = es.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (vis) setActive(vis.target.id);
    }, { rootMargin: "-25% 0px -55% 0px", threshold: [0, 0.15, 0.5, 1] });
    els.forEach((e) => io.observe(e));
    const onScroll = () => setRaised(scrollY > 8);
    onScroll(); addEventListener("scroll", onScroll, { passive: true });
    return () => { io.disconnect(); removeEventListener("scroll", onScroll); };
  }, [hasResults]); // eslint-disable-line react-hooks/exhaustive-deps

  const link = (id: string, label: string) => (
    <a key={id} href={id === "top" ? "#top" : `#${id}`} onClick={(e) => { e.preventDefault(); go(id); }} aria-current={active === id ? "location" : undefined}
      className={cx("rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap no-underline transition-colors", active === id ? "bg-surface text-ink shadow-sm" : "text-mut hover:text-ink")}>{label}</a>
  );

  return (
    <header className={cx("sticky top-0 z-50 border-b bg-surface/80 backdrop-blur-md transition-colors print:hidden", raised ? "border-line" : "border-transparent")}>
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-3 px-4">
        <a href="#top" onClick={(e) => { e.preventDefault(); go("top"); }} aria-label="Wayleave, back to top" className="no-underline"><Brand /></a>
        <nav aria-label="Primary" className="hidden items-center gap-1 rounded-full bg-sunk p-1 md:flex">{LINKS.map(([id, l]) => link(id, l))}</nav>
        <div className="flex items-center gap-2">
          {hasSample && <button type="button" onClick={onSample} className="hidden h-10 items-center rounded-full border border-line2 bg-surface px-4 text-sm font-medium text-ink transition-colors hover:border-ink sm:flex">Sample run</button>}
          <button type="button" onClick={onCompare} className="flex h-10 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-ink transition hover:opacity-90 active:scale-[0.98]">New comparison</button>
        </div>
      </div>
      <nav aria-label="Primary (compact)" className="flex gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:hidden">{LINKS.map(([id, l]) => link(id, l))}</nav>
    </header>
  );
}

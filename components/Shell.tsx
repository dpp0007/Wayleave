import Link from "next/link";
import type { ReactNode } from "react";
import Brand from "./Brand";

/** Shared frame for the plain content pages (privacy, terms, 404): the brand, a way back, a readable column, and the footer links. */
export default function Shell({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link href="/" aria-label="Wayleave home" className="no-underline"><Brand /></Link>
          <Link href="/" className="text-sm text-mut hover:text-ink">← Back to Wayleave</Link>
        </div>
      </header>
      <main className="mx-auto min-h-[60vh] max-w-3xl px-4 py-12">
        <h1 className="text-4xl leading-tight">{title}</h1>
        {updated && <p className="mt-2 text-sm text-mut">Last updated {updated}</p>}
        <div className="mt-8 space-y-4 text-[15px] leading-7 [&_a]:text-accent [&_a]:underline [&_h2]:mt-10 [&_h2]:text-2xl [&_li]:text-mut [&_p]:text-mut [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">{children}</div>
      </main>
      <footer className="border-t border-line">
        <nav aria-label="Footer" className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-5 gap-y-1 px-4 py-6 text-xs text-mut">
          <Link href="/" className="hover:text-ink hover:underline">Home</Link>
          <Link href="/privacy" className="hover:text-ink hover:underline">Privacy</Link>
          <Link href="/terms" className="hover:text-ink hover:underline">Terms</Link>
          <a href="https://github.com/dpp0007/Wayleave" target="_blank" rel="noopener noreferrer" className="hover:text-ink hover:underline">GitHub</a>
        </nav>
      </footer>
    </>
  );
}

"use client";
import { useState } from "react";
import { toMarkdown } from "@/lib/export";
import type { Data } from "@/lib/types";
import { button } from "../ui";

/** Take the comparison with you: paste into an email, print to PDF, or keep the raw JSON. */
export default function ExportBar({ data, activity }: { data: Data; activity: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(toMarkdown(data, activity)); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ activity, ...data }, null, 2)], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${activity.replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}.json` });
    a.click(); URL.revokeObjectURL(url);
  };
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <button type="button" onClick={copy} className={button.ghost}>{copied ? "✓ Copied" : "Copy as Markdown"}</button>
      <button type="button" onClick={() => window.print()} className={button.ghost}>Print / Save PDF</button>
      <button type="button" onClick={download} className={button.ghost}>Download JSON</button>
    </div>
  );
}

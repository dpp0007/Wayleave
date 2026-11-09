import Link from "next/link";
import Shell from "@/components/Shell";
import { button } from "@/components/ui";

export default function NotFound() {
  return (
    <Shell title="This page doesn’t exist">
      <p>The link may be old or mistyped. The comparison tool is on the home page.</p>
      <p><Link href="/" className={`${button.primary} no-underline`} style={{ color: "var(--primary-ink)" }}>Back to Wayleave</Link></p>
    </Shell>
  );
}

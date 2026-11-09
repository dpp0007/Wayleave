import type { Metadata } from "next";
import Shell from "@/components/Shell";

export const metadata: Metadata = { title: "Terms", description: "Wayleave is an informational comparison tool, not legal advice. The terms of use." };

export default function Terms() {
  return (
    <Shell title="Terms of use" updated="9 November 2026">
      <p>By using Wayleave you agree to these terms. They are short on purpose.</p>

      <h2>What Wayleave is</h2>
      <p>Wayleave compares the licences, filings, costs and approval times for one activity across places, using official government pages that it reads and re-checks automatically. It is a decision aid.</p>

      <h2>Not legal advice</h2>
      <p><strong>Nothing on Wayleave is legal, tax or professional advice.</strong> Rules, fees and timelines change and depend on the details of your business. Confirm everything with a qualified local professional before you act. Wayleave does not check whether any person or business holds a licence.</p>

      <h2>Accuracy</h2>
      <ul>
        <li>Figures come from official pages as they were when read. Each item shows its source link and the date it was checked.</li>
        <li>Automated reading can be wrong or incomplete. Where a fee or time is not stated, it is shown as a gap, and totals are floors, not budgets.</li>
        <li>Currency conversions are indicative. The local-currency figure is the one to rely on.</li>
      </ul>

      <h2>Acceptable use</h2>
      <ul>
        <li>Use Wayleave for its intended purpose. Do not try to overload it, bypass its limits, probe it for weaknesses without permission, or use it to send harmful content to its upstream services.</li>
        <li>Each comparison uses paid research credits. Usage limits apply and may be tightened or an access code required at any time.</li>
      </ul>

      <h2>Third-party content and services</h2>
      <p>Source pages belong to their publishers and are linked, not copied wholesale. Wayleave relies on third-party services (TinyFish, Google Gemini, exchange-rate providers, and its host) and cannot guarantee their availability.</p>

      <h2>No warranty, limited liability</h2>
      <p>Wayleave is provided “as is” and “as available”, without warranties of any kind. To the fullest extent permitted by law, the operators are not liable for any loss arising from use of, or reliance on, the service or its results.</p>

      <h2>Changes and contact</h2>
      <p>These terms may change; the date above shows the latest version. Questions can be raised on the <a href="https://github.com/dpp0007/Wayleave/issues" target="_blank" rel="noopener noreferrer">project’s GitHub page</a>. See also the <a href="/privacy">privacy page</a>.</p>
    </Shell>
  );
}

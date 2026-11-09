import type { Metadata } from "next";
import Shell from "@/components/Shell";

export const metadata: Metadata = { title: "Privacy", description: "What Wayleave sends where, what it stores, and what it does not collect." };

export default function Privacy() {
  return (
    <Shell title="Privacy" updated="9 November 2026">
      <p>Wayleave has no accounts, no database, and no advertising or analytics. This page says exactly what happens to what you type.</p>

      <h2>What you enter</h2>
      <p>You describe an activity (for example “open a small café”) and choose three to five places. Please do not enter personal, confidential or commercially sensitive information. Only an activity and place names are needed.</p>

      <h2>Where it goes</h2>
      <ul>
        <li><strong>TinyFish</strong> (Search, Research, Fetch and Agent). Your activity and places are sent to find and read official government pages. TinyFish keeps research runs on its own account under its own terms.</li>
        <li><strong>Google Gemini.</strong> Short excerpts of those official pages, and the figures extracted from them, are sent to double-check fees, currencies and times. Your activity and places are not needed for this step and the excerpts are public government text.</li>
        <li><strong>Exchange-rate services</strong> (open.er-api.com, the jsDelivr currency-api and Frankfurter/ECB). These receive no information about you or your inputs. They are only asked for public rates.</li>
        <li><strong>Hosting.</strong> The site is hosted on Vercel, which may log technical request data such as IP address and browser type for operation and security.</li>
      </ul>

      <h2>What Wayleave stores</h2>
      <ul>
        <li><strong>On our servers: nothing.</strong> The service is stateless. Results are not saved, and your inputs are not logged by the application.</li>
        <li><strong>In your browser:</strong> while a comparison is running, its progress is kept in your browser’s local storage so you can close the tab and come back. It is removed when the comparison finishes or you start over.</li>
        <li><strong>One cookie, only if enabled:</strong> some deployments require an access code. If so, a single strictly necessary cookie (<code>wl_access</code>, HttpOnly, 7 days) remembers that you entered it. No tracking cookies are used.</li>
      </ul>

      <h2>Your choices</h2>
      <p>You can clear local storage and cookies in your browser at any time. To ask a question or raise a concern, open an issue on the <a href="https://github.com/dpp0007/Wayleave/issues" target="_blank" rel="noopener noreferrer">project’s GitHub page</a>. For a security problem, please follow the <a href="https://github.com/dpp0007/Wayleave/blob/main/SECURITY.md" target="_blank" rel="noopener noreferrer">security policy</a> instead of posting publicly.</p>

      <h2>Changes</h2>
      <p>If this changes, the date above changes with it.</p>
    </Shell>
  );
}

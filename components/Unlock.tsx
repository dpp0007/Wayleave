"use client";
import { useState } from "react";
import { Card, Spinner, button } from "./ui";

/** Shown only when the deployment sets ACCESS_CODE: research spends the owner's credits, so it can be limited to people with the code. */
export default function Unlock({ onUnlock }: { onUnlock: (code: string) => Promise<void> }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Card className="mx-auto max-w-md">
      <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(""); try { await onUnlock(code); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); } }} className="space-y-3">
        <div>
          <h2 className="text-lg">Enter the access code</h2>
          <p className="mt-1 text-sm text-mut">This deployment limits research to people with the code, because each comparison uses paid research credits.</p>
        </div>
        <input type="password" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" aria-label="Access code" maxLength={200}
          className="h-11 w-full rounded-xl border border-line bg-sunk px-3 text-sm outline-none focus:border-ink" />
        {err && <p role="alert" className="text-sm text-bad">{err}</p>}
        <button disabled={busy || !code} className={button.primary}>{busy ? <><Spinner /> Checking</> : "Unlock"}</button>
      </form>
    </Card>
  );
}

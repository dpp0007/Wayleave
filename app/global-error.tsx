"use client";

// Last-resort boundary: it replaces the whole document, so it cannot rely on the app's theme or fonts and styles itself inline.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f6f6fa", color: "#16161d" }}>
        <main style={{ maxWidth: 560, margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", gap: 16, padding: 16 }}>
          <h1 style={{ fontSize: 28, margin: 0 }}>Wayleave hit a problem</h1>
          <p style={{ margin: 0, color: "#656573" }}>Something unexpected happened. Please try again.</p>
          <button onClick={reset} style={{ alignSelf: "flex-start", height: 44, padding: "0 20px", borderRadius: 12, border: 0, background: "#16161d", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Try again</button>
        </main>
      </body>
    </html>
  );
}

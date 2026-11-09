"use client";
import { button } from "@/components/ui";

// Shown when something in the page throws. The message is deliberately generic; the real error stays in the server and browser logs.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center gap-4 px-4">
      <h1 className="text-3xl">Something went wrong</h1>
      <p className="text-mut">The page hit an unexpected problem. Your inputs were not lost on our side, because nothing is stored. Try again, or reload the page.</p>
      <div className="flex gap-2">
        <button onClick={reset} className={button.primary}>Try again</button>
        <a href="/" className={`${button.ghost} no-underline`}>Home</a>
      </div>
    </main>
  );
}

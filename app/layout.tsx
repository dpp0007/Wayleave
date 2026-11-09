import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Fraunces, Inter } from "next/font/google";
import { SITE } from "@/lib/site";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Fraunces({ subsets: ["latin"], variable: "--font-serif", display: "swap" });

const description = "Where is it easiest to start? Compare licences, filings, costs and approval times for one activity across places, from official government pages, each re-read live and double-checked.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "Wayleave: where is it easiest to start?", template: "%s · Wayleave" },
  description,
  applicationName: "Wayleave",
  openGraph: { type: "website", siteName: "Wayleave", title: "Wayleave: where is it easiest to start?", description },
  twitter: { card: "summary", title: "Wayleave: where is it easiest to start?", description },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f6f6fa" }, { media: "(prefers-color-scheme: dark)", color: "#101014" }],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" className={`${sans.variable} ${serif.variable}`}><body>{children}</body></html>;
}

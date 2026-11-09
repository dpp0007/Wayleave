import "./globals.css";
import type { ReactNode } from "react";
import { Fraunces, Inter } from "next/font/google";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Fraunces({ subsets: ["latin"], variable: "--font-serif", display: "swap" });

export const metadata = {
  title: "Wayleave: where is it easiest to start?",
  description: "Where is it easiest to start? Compare licences, filings, costs and approval times for one activity across places, sourced from official government pages.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" className={`${sans.variable} ${serif.variable}`}><body>{children}</body></html>;
}

/**
 * Keystroke timeline for the hero's typed placeholder, fitted to the original clip (Hero Intro Animation, lookap 5h6d0):
 * suffix after a fixed prefix reads "st" at 0.5s, is deleted, then "linear.app" is typed from 0.76s (done ~1.46s) and held,
 * deleted to "line" by ~3.72s, emptied by 3.98s, then "not" at 4.25s and "notion.com" by ~5.0s.
 * Same cadence here with this project's strings: ~70-87 ms per typed character, 60 ms per deleted one.
 */
type Script = [t: number, text: string][];

export function buildScript(decoy: string, first: string, keep: number, second: string): Script {
  const s: Script = [[0, ""]];
  const type = (text: string, t0: number, step: number) => [...text].forEach((_, k) => s.push([+(t0 + k * step).toFixed(3), text.slice(0, k + 1)]));
  const erase = (from: string, to: number, t0: number, step: number) => { for (let n = from.length - 1, k = 0; n >= to; n--, k++) s.push([+(t0 + k * step).toFixed(3), from.slice(0, n)]); };
  type(decoy, 0.3, 0.1);                       // "st"            0.30 - 0.40
  erase(decoy, 0, 0.58, 0.06);                 // deleted         0.58 - 0.64
  type(first, 0.76, 0.07);                     // "linear.app"    0.76 - 1.46  (held to 3.42)
  erase(first, keep, 3.42, 0.06);              // down to "line"  3.42 - 3.72
  erase(first.slice(0, keep), 0, 3.8, 0.06);   // then emptied    3.80 - 3.98
  type(second, 4.07, 0.085);                   // "not" at 4.24, "notion." at 4.58, 10 chars done 4.84
  return s;
}

export const scriptEnd = (s: Script) => s[s.length - 1][0];

/** Text on screen at time t (seconds): the last state whose time has passed. */
export function textAt(s: Script, t: number): string {
  let out = "";
  for (const [ts, text] of s) { if (ts <= t) out = text; else break; }
  return out;
}

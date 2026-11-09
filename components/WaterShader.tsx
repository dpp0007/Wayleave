"use client";
/**
 * Liquid surface along the bottom of the hero.
 * Remixed from "Hero Intro Animation" by Yahia Bakour (@mynameisyahia), via lookap entry 5h6d0-hero-intro-animation
 * (https://x.com/i/status/2083110817055306161). Original is a WebGL water shader; this is an SVG lighting filter driven by Motion.
 * Timing is the clip's: choppy flat ripples at 0s grow into large glossy swells with thin specular crests, change is fastest
 * around 1.5-2s, slows through 4-4.5s and is frozen from 4.5s on.
 */
import { animate, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef } from "react";

const FROM = { fx: 0.024, fy: 0.085, relief: 1.6 }; // small choppy ripple patches
const TO = { fx: 0.0065, fy: 0.022, relief: 7.5 };  // large glossy swells
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

export default function WaterShader({ className = "" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const turb = useRef<SVGFETurbulenceElement>(null);
  const diff = useRef<SVGFEDiffuseLightingElement>(null);
  const spec = useRef<SVGFESpecularLightingElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const set = (p: number) => {
      turb.current?.setAttribute("baseFrequency", `${lerp(FROM.fx, TO.fx, p)} ${lerp(FROM.fy, TO.fy, p)}`);
      const relief = String(lerp(FROM.relief, TO.relief, p));
      diff.current?.setAttribute("surfaceScale", relief);
      spec.current?.setAttribute("surfaceScale", relief);
    };
    if (reduce) { set(1); return; }                       // reduced motion: show the settled surface, no entrance
    set(0);
    // peak velocity near 1.5-2s of 4.5s, eases to a full stop at 4.5s (frozen afterwards, as in the clip)
    const run = animate(0, 1, { duration: 4.5, ease: [0.45, 0, 0.2, 1], onUpdate: set });
    return () => run.stop();
  }, [reduce]);

  return (
    <svg aria-hidden className={className} width="100%" height="100%" preserveAspectRatio="none"
      style={{ ["--sh-mid" as string]: "color-mix(in oklab, var(--accent) 82%, var(--ink))", ["--sh-crest" as string]: "color-mix(in oklab, var(--warm) 60%, var(--surface))" }}>
      <defs>
        <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence ref={turb} type="fractalNoise" baseFrequency="0.024 0.085" numOctaves={2} seed={11} result="n" />
          {/* noise -> height map in alpha */}
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.7 0.7 0.7 0 -0.05" result="h" />
          <feDiffuseLighting ref={diff} in="h" surfaceScale={1.6} diffuseConstant={1.15} result="d" style={{ lightingColor: "var(--sh-mid)" }}>
            <feDistantLight azimuth={235} elevation={46} />
          </feDiffuseLighting>
          <feSpecularLighting ref={spec} in="h" surfaceScale={1.6} specularConstant={1.25} specularExponent={26} result="s" style={{ lightingColor: "var(--sh-crest)" }}>
            <feDistantLight azimuth={235} elevation={36} />
          </feSpecularLighting>
          <feComposite in="s" in2="d" operator="arithmetic" k1={0} k2={0.9} k3={1} k4={0} />
        </filter>
      </defs>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  );
}

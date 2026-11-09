// Wayleave: the mark shows three places converging into one checked, chosen path. A wayleave is a permission to pass.
export default function Brand() {
  return (
    <div className="flex items-center gap-2.5 font-serif text-xl font-semibold">
      <svg aria-hidden viewBox="0 0 32 32" className="size-8 shrink-0">
        <defs>
          <linearGradient id="wl-g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="var(--accent)" />
            <stop offset="1" stopColor="var(--warm)" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#wl-g)" />
        <g fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7.5 9.5C13 9.5 14 16 19 16" /><path d="M7.5 16H19" /><path d="M7.5 22.5C13 22.5 14 16 19 16" />
        </g>
        <g fill="#fff"><circle cx="7.5" cy="9.5" r="1.9" /><circle cx="7.5" cy="16" r="1.9" /><circle cx="7.5" cy="22.5" r="1.9" /><circle cx="22.8" cy="16" r="4.6" /></g>
        <path d="M20.6 16.2l1.5 1.5 2.7-3" fill="none" stroke="var(--accent)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="max-[520px]:sr-only">Wayleave</span>
    </div>
  );
}

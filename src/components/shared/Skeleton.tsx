import type { JSX } from "react";

// Route-transition skeletons (T3-D).
//
// WHY THESE EXIST: the app had ZERO `loading.tsx` files, so a tab tap did
// nothing visible until every server-side Supabase round-trip finished —
// measured at 0.8–1.2s per screen, and identical in a production build, so it
// was never a dev-mode artifact. Next.js keeps the OLD screen on-screen for
// that whole time, which reads as the app freezing. Marcus described it as "a
// long buffer time between windows and screens".
//
// A `loading.tsx` turns that into: tap → new screen's shape appears instantly
// → content fills in. The wall-clock wait is unchanged; the dead air is not.
// That is the honest framing — these are a PERCEPTION fix, and the queries
// behind them still need parallelising to make the number itself smaller.
//
// Deliberately NOT animated with a shimmer sweep: this is a calm, light
// interface, and a pulsing gradient across a whole screen every time you
// change tab is the opposite of calm. A single slow opacity pulse, and it
// stops entirely under `prefers-reduced-motion` (see `.skeleton` in
// globals.css).

/** One grey block. `w`/`h` are Tailwind classes so callers control the shape. */
export function SkeletonBox({
  className = "",
}: {
  className?: string;
}): JSX.Element {
  return <div className={`skeleton rounded-lg ${className}`} aria-hidden="true" />; // prettier-ignore
}

/**
 * The page-level wrapper. Carries the live region so assistive tech announces
 * the load instead of silently swapping content — a skeleton is invisible to a
 * screen reader otherwise.
 */
export function SkeletonScreen({
  children,
  label = "Loading",
}: {
  children: React.ReactNode;
  label?: string;
}): JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex flex-col gap-6"
    >
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Eyebrow + title, the shape every member screen opens with. */
export function SkeletonHeader(): JSX.Element {
  return (
    <div className="space-y-2">
      <SkeletonBox className="h-2.5 w-20" />
      <SkeletonBox className="h-8 w-48" />
    </div>
  );
}

/** A stack of card rows — the shape of most list screens. */
export function SkeletonList({
  rows = 3,
  height = "h-20",
}: {
  rows?: number;
  height?: string;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonBox key={i} className={`w-full ${height}`} />
      ))}
    </div>
  );
}

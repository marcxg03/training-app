import Link from "next/link";
import { ChevronRight, Flame } from "lucide-react";

type FuelGlanceRowProps = {
  /** Optional eyebrow label, e.g. "Lifting day · fuel". Presentational. */
  label?: string;
  /** Optional macro summary line. Presentational. */
  summary?: string;
};

export function FuelGlanceRow({
  label = "Today · fuel",
  summary = "Tap to log meals and track macros",
}: FuelGlanceRowProps) {
  return (
    <Link
      href="/nutrition"
      className="flex items-center gap-3 rounded-2xl border border-border bg-card-alt px-4 py-3.5 transition-colors hover:border-accent/40"
    >
      <Flame className="h-5 w-5 shrink-0 text-cardio" />
      <div className="min-w-0">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
          {label}
        </p>
        <p className="mt-0.5 truncate font-mono text-[13px] font-semibold tabular-nums text-subtle">
          {summary}
        </p>
      </div>
      <ChevronRight className="ml-auto h-5 w-5 shrink-0 text-faint" />
    </Link>
  );
}

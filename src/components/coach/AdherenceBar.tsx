import { cn } from "@/lib/utils/cn";

type AdherenceBarProps = {
  /** 0–100 fill percentage. */
  pct: number;
  /** Right-aligned label, e.g. "2/6 wk". */
  label: string;
  /** Tone hint: behind weeks render in warning, on-track in success. */
  behind?: boolean;
};

/** Slim weekly-adherence progress bar used on roster cards. */
export function AdherenceBar({
  pct,
  label,
  behind = false,
}: AdherenceBarProps) {
  const clamped = Math.max(0, Math.min(100, pct));

  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-card-alt">
        <div
          className={cn(
            "h-full rounded-full",
            behind ? "bg-warning" : "bg-success",
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="font-mono text-[10px] font-semibold tabular-nums text-subtle">
        {label}
      </span>
    </div>
  );
}

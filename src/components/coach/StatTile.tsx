import { cn } from "@/lib/utils/cn";

type StatTileProps = {
  label: string;
  value: string;
  tone?: "default" | "success" | "accent" | "warning";
};

const toneClass: Record<NonNullable<StatTileProps["tone"]>, string> = {
  default: "text-foreground",
  success: "text-success",
  accent: "text-accent",
  warning: "text-warning",
};

/** Compact metric tile (adherence / PRs / fuel) used on detail + review. */
export function StatTile({ label, value, tone = "default" }: StatTileProps) {
  return (
    <div className="flex-1 rounded-xl border border-border bg-card p-3.5">
      <p className="eyebrow tracking-[0.1em] text-faint">{label}</p>
      <p
        className={cn(
          "mt-1.5 font-mono text-lg font-semibold tabular-nums",
          toneClass[tone],
        )}
      >
        {value}
      </p>
    </div>
  );
}

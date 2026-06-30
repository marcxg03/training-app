import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

type CoachActionRowProps = {
  href: string;
  icon: LucideIcon;
  label: string;
  /** Optional mono caption under the label. */
  caption?: string;
  /** Optional count badge (e.g. number of notes). */
  badge?: number;
};

/** A tappable coach-action row on the client workspace (Frame 41). */
export function CoachActionRow({
  href,
  icon: Icon,
  label,
  caption,
  badge,
}: CoachActionRowProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3.5 rounded-[13px] border border-border bg-card p-3.5 transition-colors hover:border-accent/60"
    >
      <Icon className="h-5 w-5 flex-none text-accent" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        {caption ? (
          <p className="eyebrow mt-0.5 tracking-[0.06em] text-faint">
            {caption}
          </p>
        ) : null}
      </div>
      {typeof badge === "number" ? (
        <span className="rounded-md bg-accent/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-accent">
          {badge}
        </span>
      ) : null}
      <ChevronRight className="h-[19px] w-[19px] flex-none text-faint" />
    </Link>
  );
}

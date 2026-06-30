import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type CoachPageHeaderProps = {
  title: string;
  subtitle?: string;
  backHref: string;
  backLabel?: string;
};

/** Coach-section in-page header with a back affordance. Coach routes use this
 * instead of the athlete BottomTabBar (which stays untouched). */
export function CoachPageHeader({
  title,
  subtitle,
  backHref,
  backLabel = "Back",
}: CoachPageHeaderProps) {
  return (
    <div className="flex items-center gap-3 pb-3">
      <Link
        href={backHref}
        aria-label={backLabel}
        className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-border bg-card-alt text-subtle transition-colors hover:border-accent/50 hover:text-foreground"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <div>
        <h1 className="text-base font-semibold text-foreground">{title}</h1>
        {subtitle ? (
          <p className="eyebrow mt-0.5 tracking-[0.08em] text-faint">
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}

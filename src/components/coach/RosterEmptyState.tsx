import Link from "next/link";
import { UserPlus, Users } from "lucide-react";

/** Empty-roster state (Frame 39) — the first-run coach experience. */
export function RosterEmptyState() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-[18px] border border-border bg-card">
          <Users className="h-8 w-8 text-accent" />
        </span>
        <h2 className="mt-5 text-[22px] font-semibold tracking-tight text-foreground">
          Bring on your first client
        </h2>
        <p className="mt-2.5 text-[13px] leading-relaxed text-subtle">
          Invite someone by email or share a join link. They&apos;ll get their
          own login and follow the plan you assign — you&apos;ll see their
          progress here.
        </p>
      </div>
      <Link
        href="/coach/onboard"
        className="flex items-center justify-center gap-2 rounded-[13px] bg-accent px-4 py-4 font-mono text-[13px] font-bold uppercase tracking-[0.08em] text-black transition-colors hover:bg-accent/90"
      >
        <UserPlus className="h-5 w-5" />
        Onboard a client
      </Link>
    </div>
  );
}

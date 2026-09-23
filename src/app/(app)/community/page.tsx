import { Users } from "lucide-react";

/**
 * /community — S0 placeholder (D21).
 *
 * The 5th tab must be navigable now; the real storefront/feed is built in S6.
 * Honest "coming soon" — no fake data pretending to be live. Uses only design
 * tokens (light + Satoshi).
 */
export default function CommunityPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
          Community
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
          Coming soon
        </h1>
      </div>

      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-card-alt px-6 py-12 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-input text-subtle">
          <Users className="h-7 w-7" />
        </span>
        <div className="flex max-w-xs flex-col gap-1">
          <p className="text-base font-semibold text-foreground">
            Programs &amp; feed
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Subscribe to training programs, share progress, and cheer each other
            on. This tab is on the way — for now it&apos;s just a placeholder.
          </p>
        </div>
      </div>
    </div>
  );
}

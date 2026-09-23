import { Sparkles } from "lucide-react";

/**
 * /community — designed "coming soon" placeholder (Slice S6 · D21).
 *
 * D21: Community THIS build is a NAVIGABLE PLACEHOLDER, not a live storefront —
 * nothing can publish programs until the desktop admin hub exists, so a
 * "working" storefront would be empty. This renders the storefront/feed SHELL
 * from `/demo` CommunityScreen in the real light/Satoshi language, but honestly
 * marked as a preview: every interactive affordance is disabled with a "Soon"
 * pill, and the feed is explicitly an EXAMPLE — no fabricated live numbers
 * (subscriber counts / support counts) are presented as real data.
 *
 * D20: the tiers previewed here are free app → paid subscription (~$15/mo, free
 * during beta) → a FUTURE 1-on-1 coaching inquiry funnel (FUTURE_WORK #11).
 *
 * The real Community (storefront, subscribe, load, feed) builds together WITH
 * the desktop admin hub as the next build, on real data — do NOT wire a
 * subscription/feed backend here.
 */

// A single disabled "Soon" pill, reused across the preview's dead affordances.
function SoonPill() {
  return (
    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-faint">
      Soon
    </span>
  );
}

export default function CommunityPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8">
      <header className="space-y-1">
        <p className="eyebrow">Community</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Coming soon
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          Subscribe to training programs, load them into your week, and share
          progress with people training the same block. Here&apos;s a preview of
          what&apos;s on the way — nothing below is live yet.
        </p>
      </header>

      {/* Preview banner — makes the placeholder honest at a glance. */}
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-card-alt px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-input text-subtle">
          <Sparkles className="h-4 w-4" />
        </span>
        <p className="text-[13px] leading-relaxed text-subtle">
          <span className="font-semibold text-foreground">Preview.</span>{" "}
          Programs, subscriptions, and the feed launch with the creator hub in a
          later build.
        </p>
      </div>

      {/* Everything below is a non-interactive preview of the future surface.
          Interactive affordances are disabled (not focusable); the roadmap
          content stays readable by screen readers. Only the genuinely
          decorative skeleton blocks are aria-hidden. */}
      <div className="flex flex-col gap-6">
        {/* segmented Discover / Feed — static preview of the layout */}
        <div className="flex rounded-lg bg-input p-1 text-[11px] font-semibold uppercase tracking-wider">
          {["Discover", "Feed"].map((label, i) => (
            <span
              key={label}
              className={`flex-1 rounded-md py-1.5 text-center ${
                i === 0 ? "bg-card text-foreground shadow-sm" : "text-faint"
              }`}
            >
              {label}
            </span>
          ))}
        </div>

        {/* featured creator program — Marcus's real Block II as the seed */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex h-28 items-end bg-accent p-4">
            <div className="flex flex-col text-accent-foreground">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-foreground/70">
                By Marcus Gao
              </span>
              <span className="text-lg font-bold">Block II — Hybrid HYROX</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 p-4">
            <div className="flex flex-col">
              <span className="text-[11px] text-muted-foreground">
                7-day · lift + HYROX · nutrition included
              </span>
              <span className="text-[11px] font-medium text-subtle">
                Free during beta
              </span>
            </div>
            <button
              type="button"
              disabled
              className="flex items-center gap-2 rounded-xl border border-border bg-input px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-faint"
            >
              Subscribe
              <SoonPill />
            </button>
          </div>
        </div>

        {/* more programs — tier preview (D20: free + paid subscription) */}
        <div className="flex flex-col gap-2">
          <span className="eyebrow">More programs</span>
          {[
            ["Base Builder", "Strength · 4-day", "Free"],
            ["Cut Season", "Fat-loss · nutrition-led", "$15/mo"],
          ].map(([name, sub, price]) => (
            <div
              key={name}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
            >
              <div
                aria-hidden="true"
                className="h-12 w-12 shrink-0 rounded-lg bg-input"
              />
              <div className="flex flex-1 flex-col">
                <span className="text-sm font-semibold text-foreground">
                  {name}
                </span>
                <span className="text-[11px] text-muted-foreground">{sub}</span>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-subtle">
                {price}
              </span>
            </div>
          ))}
        </div>

        {/* 1-on-1 coaching inquiry — FUTURE funnel, not a CRM (FUTURE_WORK #11) */}
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-card-alt px-4 py-3.5 text-left">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-input text-sm text-subtle">
            ✦
          </span>
          <div className="flex flex-1 flex-col">
            <span className="text-[13px] font-semibold text-foreground">
              Train 1-on-1 with Marcus
            </span>
            <span className="text-[11px] text-muted-foreground">
              Limited spots · inquire to apply
            </span>
          </div>
          <SoonPill />
        </div>

        {/* feed peek — explicitly an EXAMPLE, not live posts */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="eyebrow">From the feed</span>
            <span className="rounded-full border border-border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-faint">
              Example
            </span>
          </div>
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <div
                aria-hidden="true"
                className="h-8 w-8 rounded-full bg-input"
              />
              <div className="flex flex-col">
                <span className="text-[13px] font-semibold text-foreground">
                  A member · Block II
                </span>
                <span className="text-[10px] uppercase tracking-wider text-faint">
                  Day 9 · Upper
                </span>
              </div>
            </div>
            <p className="text-[13px] text-subtle">
              First bodyweight dip PR today 🔥 this block is working.
            </p>
            <div className="flex items-center gap-4 text-[11px] text-faint">
              <span>♥ support</span>
              <span>◇ reply</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

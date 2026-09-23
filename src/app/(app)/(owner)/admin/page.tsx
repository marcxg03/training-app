import { BarChart3, FolderCog, Send, Users } from "lucide-react";
import Link from "next/link";

/**
 * /admin — owner-only desktop admin-hub STUB (Slice S6 · D18/D22/D25).
 *
 * Owner-gated structurally by the `(owner)/layout.tsx` guard (requireOwner) —
 * a non-owner never reaches this component (they 404). This is a seam, not a
 * feature: it names the scope the future desktop admin hub will own so the
 * next build has an anchored home.
 *
 * FUTURE SCOPE (the admin hub, next build — do NOT build here):
 *  - Program CRUD: create / edit training programs from the library builder.
 *  - Publish / archive control: push a program to Community (D21) or retire it.
 *  - The analytics dashboard: the 8-tile v1 spec computable from existing
 *    Supabase tables (North Star = Weekly Active Loggers). Reference:
 *    `spec/ADMIN_HUB_ANALYTICS.md` (D23) — cohort-retention heatmap +
 *    subscribers×adherence leaderboard are the two craft visuals.
 *
 * Authoring today still lives in the existing owner-only routes (the Library
 * builder at `/library/**`, plan/day editing at `/plan/edit`) — this hub will
 * absorb and unify them.
 */

const FUTURE_SECTIONS = [
  {
    icon: FolderCog,
    title: "Programs",
    description:
      "Create and edit training programs — the library builder, unified into one authoring surface.",
  },
  {
    icon: Send,
    title: "Publish & archive",
    description:
      "Push a program to Community for subscribers to load, or retire it. Nothing publishes until this ships.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    description:
      "The 8-tile health dashboard — North Star is Weekly Active Loggers. Spec: spec/ADMIN_HUB_ANALYTICS.md.",
  },
  {
    icon: Users,
    title: "Members",
    description:
      "Subscribers, program adherence, and the 1-on-1 coaching inquiry funnel (a lead funnel, not a CRM).",
  },
] as const;

export default function AdminPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="space-y-1">
        <p className="eyebrow">Owner · Admin</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Admin hub
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          The admin hub for authoring and running the app — program authoring,
          publish/archive control, and app analytics — best used on a wide
          screen. This is a placeholder seam; the sections below name what it
          will own, none are built yet.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {FUTURE_SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <div
              key={section.title}
              className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-input text-accent">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {section.title}
                </span>
                <span className="ml-auto rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-faint">
                  Soon
                </span>
              </div>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                {section.description}
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        <p className="eyebrow">Available now</p>
        <Link
          href="/library/exercises"
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-accent/40"
        >
          <FolderCog className="h-5 w-5 shrink-0 text-accent" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground">
              Exercise library
            </span>
            <span className="block text-xs text-subtle">
              Edit exercises, blocks, and activities
            </span>
          </span>
        </Link>
      </div>
    </div>
  );
}

import Link from "next/link";
import {
  CalendarDays,
  Dumbbell,
  FolderCog,
  Layers,
  ListChecks,
} from "lucide-react";

import { requireOwner } from "@/lib/auth/requireOwner";
import { createClient } from "@/lib/supabase/server";

/**
 * /admin — the hub's Overview (T3-A · D18).
 *
 * REPLACED the S6 stub, which was four cards reading "Soon" and one working
 * link. This page shows REAL COUNTS from the owner's own tables, because the
 * one thing an overview must never do is describe a system instead of
 * reporting on it.
 *
 * Scope note — deliberately NOT here: WAU, MRR, churn, subscriber counts. The
 * analytics spec (spec/ADMIN_HUB_ANALYTICS.md) assumes a `subscriptions`
 * table that does not exist, and Marcus is the only user for the next couple
 * of weeks by his own decision, so those tiles would render a confident `1`
 * or `0` and mean nothing. T3-C builds the tiles that are true at n=1.
 *
 * Every count is scoped to the owner's id — even though this route is
 * owner-gated, an unscoped `count` would silently start reporting everyone's
 * rows the moment a second user exists.
 */

type Tile = {
  label: string;
  value: number;
  hint: string;
  icon: typeof Dumbbell;
  href: string;
};

export default async function AdminOverviewPage() {
  const ownerId = await requireOwner();
  const supabase = await createClient();

  // head:true fetches no rows — just the count. Six cheap COUNT queries in
  // parallel rather than six sequential round-trips.
  const countOf = async (
    table: "exercises" | "blocks" | "workout_defs" | "plan_templates",
    column: string,
  ) => {
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq(column, ownerId);

    if (error) {
      // A broken count must not blank the whole hub; report it as unknown.
      console.error(`admin overview: count(${table}) failed`, error.message);
      return -1;
    }

    return count ?? 0;
  };

  const [exercises, blocks, workoutDefs, templates, activePlan] =
    await Promise.all([
      countOf("exercises", "user_id"),
      countOf("blocks", "owner_user_id"),
      countOf("workout_defs", "owner_user_id"),
      countOf("plan_templates", "owner_user_id"),
      supabase
        .from("training_plans")
        .select("name")
        .eq("user_id", ownerId)
        .eq("is_active", true)
        .maybeSingle(),
    ]);

  const tiles: Tile[] = [
    {
      label: "Exercises",
      value: exercises,
      hint: "in the library",
      icon: Dumbbell,
      href: "/library/exercises",
    },
    {
      label: "Blocks",
      value: blocks,
      hint: "reusable banks",
      icon: Layers,
      href: "/library/lifting",
    },
    {
      label: "Workouts",
      value: workoutDefs,
      hint: "defined sessions",
      icon: ListChecks,
      href: "/library/workouts",
    },
    {
      label: "Programs",
      value: templates,
      hint: "saved templates",
      icon: FolderCog,
      href: "/admin/programs",
    },
  ];

  const activePlanName = activePlan.data?.name ?? null;

  return (
    <div className="flex flex-col gap-8">
      <header className="space-y-1.5">
        <p className="eyebrow">Owner · Admin</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Overview
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          {activePlanName ? (
            <>
              Active plan:{" "}
              <span className="font-medium text-foreground">
                {activePlanName}
              </span>
              .
            </>
          ) : (
            <>No plan is currently active.</>
          )}{" "}
          Authoring lives here; the member app is what you train against.
        </p>
      </header>

      <section className="space-y-3" aria-labelledby="library-heading">
        <p className="eyebrow" id="library-heading">
          Your library
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((tile) => {
            const Icon = tile.icon;
            const unknown = tile.value < 0;

            return (
              <Link
                key={tile.label}
                href={tile.href}
                className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-colors hover:border-accent/40"
              >
                <span className="flex items-center gap-2 text-faint">
                  <Icon className="h-4 w-4" />
                  <span className="eyebrow">{tile.label}</span>
                </span>
                <span className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">
                  {unknown ? "—" : tile.value}
                </span>
                <span className="text-xs text-subtle">
                  {unknown ? "count unavailable" : tile.hint}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="authoring-heading">
        <p className="eyebrow" id="authoring-heading">
          Authoring
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/plan/edit"
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-accent/40"
          >
            <CalendarDays className="h-5 w-5 shrink-0 text-accent" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">
                Weekly schedule
              </span>
              <span className="block text-xs text-subtle">
                Which workouts land on which day
              </span>
            </span>
          </Link>
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
                Exercises, blocks, and activities
              </span>
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";

import { PlanEditForm } from "./_components/PlanEditForm";
import { requireOwner } from "@/lib/auth/requireOwner";
import { getPlanEditData } from "@/lib/plan/queries";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/types";

const DAY_LABELS: Record<Enums<"day_of_week_enum">, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

/**
 * /admin/programs/<plan_id> — the week editor for ONE program (T3-C · D48).
 *
 * This is the page `/admin/schedule` used to be, with the hardcoded "whatever
 * plan is active" lookup replaced by the plan in the URL. That single change
 * is what let Schedule be folded into Programs: the editor was never
 * schedule-specific, it was just stuck on one plan.
 *
 * Ownership is checked on the ROW, not just the route. `requireOwner()` proves
 * the caller is the app owner; the `user_id` filter below proves this
 * particular program is theirs. Today those are the same person, but the
 * moment a second owner or a prescribed program exists, a route guard alone
 * would let one owner open another's plan_id by URL.
 */
export default async function ProgramWeekPage({
  params,
}: {
  params: Promise<{ plan_id: string }>;
}) {
  const ownerId = await requireOwner();
  const { plan_id: planId } = await params;

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("training_plans")
    .select("plan_id, name, is_active")
    .eq("plan_id", planId)
    .eq("user_id", ownerId)
    .maybeSingle();

  if (!plan) {
    notFound();
  }

  const data = await getPlanEditData(planId);

  if (!data) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-1.5">
        <Link
          href="/admin/programs"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-subtle transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All programs
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {plan.name}
          </h1>
          {plan.is_active ? (
            <span className="rounded-full border border-accent/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
              Active
            </span>
          ) : null}
        </div>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          The week for this program. Open a day to edit its sessions.
        </p>
      </header>

      <div className="max-w-4xl">
        <PlanEditForm data={data} />
      </div>

      <section className="space-y-3" aria-labelledby="days-heading">
        <p className="eyebrow" id="days-heading">
          Edit a day in detail
        </p>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          The week above sets which sessions land on which day. Open a day to
          edit that day&apos;s sessions and the blocks inside them.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {data.days.map((day) => (
            <Link
              key={day.day_of_week}
              href={`/admin/programs/${planId}/${day.day_of_week}`}
              className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3 transition-colors hover:border-accent/40"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium capitalize text-foreground">
                  {DAY_LABELS[day.day_of_week]}
                </span>
                <span className="block text-xs text-subtle">
                  {day.is_rest_day
                    ? "Rest day"
                    : `${day.workouts.length} ${day.workouts.length === 1 ? "session" : "sessions"}`}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

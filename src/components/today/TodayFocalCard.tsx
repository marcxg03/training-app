import Link from "next/link";
import { Check } from "lucide-react";

import { FocalCard } from "@/components/shared";
import type { Enums } from "@/lib/supabase/types";

import type { TodaySession } from "./types";

type TodayFocalCardProps = {
  /** The primary session of the day (the first lifting session, else the first). */
  session: TodaySession;
  /** Day the session belongs to; carried into the read-only detail link. */
  day: Enums<"day_of_week_enum">;
  /** False when previewing another day of the plan — suppresses Start. */
  isToday: boolean;
};

const typeLabel: Record<Enums<"session_type_enum">, string> = {
  lifting: "Lift",
  cardio: "Cardio",
  recovery: "Recovery",
};

const timingLabel: Record<Enums<"timing_enum">, string> = {
  am: "AM",
  pm: "PM",
  anytime: "Now",
};

/**
 * TodayFocalCard — the single dominant accent card on Today, composing the
 * shared `FocalCard`. The CTA is the primary lift's Start Workout: a plain
 * navigation to the real logger (`/log/[workout_id]`), which is where the
 * workout completion is created server-side — so `actionHref` preserves the
 * exact start behavior (no client action needed). A completed lift stays
 * tappable: its action is a Link to the session detail ("✓ Completed — View
 * session ▸"), so the card is never a dead end. A non-lift or read-only day
 * links to detail.
 */
export function TodayFocalCard({ session, day, isToday }: TodayFocalCardProps) {
  const isLift = session.workoutType === "lifting";
  const canStart = isToday && isLift && !session.completed;
  const isCompletedLift = isToday && isLift && session.completed;

  const detailHref = isToday
    ? `/today/workout/${session.workoutId}`
    : `/today/workout/${session.workoutId}?day=${day}`;

  const completedAction = (
    <Link
      href={detailHref}
      className="mt-1 flex h-12 items-center justify-center gap-2 rounded-xl bg-accent-foreground/15 text-sm font-bold uppercase tracking-wider text-accent-foreground transition-colors hover:bg-accent-foreground/25"
    >
      <Check className="h-4 w-4" />
      Completed — View session ▸
    </Link>
  );

  const actionProps = canStart
    ? {
        actionLabel: "Start Workout ▸",
        actionHref: `/log/${session.workoutId}`,
      }
    : isCompletedLift
      ? { action: completedAction }
      : { actionLabel: "View session ▸", actionHref: detailHref };

  return (
    <FocalCard
      badge={`${typeLabel[session.workoutType]} · ${timingLabel[session.timing]}`}
      meta={session.gym ? session.gym.toUpperCase() : undefined}
      title={session.workoutName}
      subtitle={session.summary}
      {...actionProps}
    />
  );
}

import { Check } from "lucide-react";

import { SessionRow } from "@/components/shared";
import type { Enums } from "@/lib/supabase/types";

import type { TodaySession } from "./types";

type TodayAlsoListProps = {
  /** Every session except the focal one. */
  sessions: TodaySession[];
  /** Day these sessions belong to; carried into read-only detail links. */
  day: Enums<"day_of_week_enum">;
  /** False when previewing another day (detail links carry ?day). */
  isToday: boolean;
};

// Bare inline glyphs by session type, matching the /demo "Also today" rows.
const glyphByType: Record<
  Enums<"session_type_enum">,
  { icon: string; className: string }
> = {
  lifting: { icon: "◆", className: "text-accent" },
  cardio: { icon: "◍", className: "text-cardio" },
  recovery: { icon: "☾", className: "text-subtle" },
};

const timingTrailing: Record<Enums<"timing_enum">, string | null> = {
  am: "AM",
  pm: "PM",
  anytime: null,
};

/**
 * TodayAlsoList — the quiet "Also today" list beneath the focal Start card,
 * composing the shared `SessionRow` in `quiet` mode (normal-weight titles, no
 * subtitle). The short detail (summary, else timing/gym) rides as faint
 * right-aligned `trailing` text; a completed session shows a muted "✓ done"
 * there instead. Routing: a LIFTING row links to the logger (`/log/[id]`) so a
 * second lift is still startable from Today; non-lift rows link to the
 * read-only Today detail route.
 */
export function TodayAlsoList({ sessions, day, isToday }: TodayAlsoListProps) {
  if (sessions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-faint">
        Also today
      </span>
      <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
        {sessions.map((session) => {
          const glyph = glyphByType[session.workoutType];
          const isLift = session.workoutType === "lifting";

          const detail =
            session.summary ||
            timingTrailing[session.timing] ||
            (session.gym ? session.gym.toUpperCase() : "");

          const href =
            isToday && isLift
              ? `/log/${session.workoutId}`
              : isToday
                ? `/today/workout/${session.workoutId}`
                : `/today/workout/${session.workoutId}?day=${day}`;

          const trailing = session.completed ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-success">
              <Check className="h-3 w-3" />
              done
            </span>
          ) : detail ? (
            <span className="text-[11px] text-faint">{detail}</span>
          ) : undefined;

          return (
            <SessionRow
              key={session.workoutId}
              href={href}
              quiet
              icon={glyph.icon}
              iconVariant="plain"
              iconClassName={glyph.className}
              title={session.workoutName}
              trailing={trailing}
            />
          );
        })}
      </div>
    </div>
  );
}

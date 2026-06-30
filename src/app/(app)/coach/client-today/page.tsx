import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Dumbbell, ShieldCheck } from "lucide-react";

import {
  getClientTodaySession,
  getMyCoach,
  linkPendingInvites,
} from "@/lib/coach/queries";

// Visual-only week rhythm mirroring the athlete TodayWeekStrip (Wed active).
const weekDays: { label: string; tone: "lift" | "cardio" | "rest" }[] = [
  { label: "M", tone: "lift" },
  { label: "T", tone: "lift" },
  { label: "W", tone: "lift" },
  { label: "T", tone: "lift" },
  { label: "F", tone: "rest" },
  { label: "S", tone: "lift" },
  { label: "S", tone: "rest" },
];

const dotToneClass: Record<"lift" | "cardio" | "rest", string> = {
  lift: "bg-accent",
  cardio: "bg-cardio",
  rest: "bg-border",
};

const ACTIVE_INDEX = 2;

/**
 * Client · Today (Frame 47) — preview of the coach-assigned plan from the
 * client side. Clients follow and log their real session on the athlete Today
 * tab; this surfaces who assigned the plan. Layout reuses the athlete Today
 * patterns (REDESIGN_BRIEF §8.2).
 */
export default async function ClientTodayPage() {
  await linkPendingInvites();
  const [coach, session] = await Promise.all([
    getMyCoach(),
    getClientTodaySession(),
  ]);

  if (!coach) {
    redirect("/coach/my-coach");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/coach/my-coach"
          aria-label="Back to my coach"
          className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-border bg-card-alt text-subtle transition-colors hover:border-accent/50 hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">
          Plan preview
        </span>
      </div>

      <div>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
          Assigned plan
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
          Today
        </h1>
      </div>

      <div className="flex items-center gap-2.5 rounded-xl border border-accent/30 bg-accent/[0.06] px-3.5 py-3">
        <ShieldCheck className="h-4 w-4 flex-none text-accent" />
        <p className="text-[11px] font-medium text-accent">
          Assigned by your coach · {coach.coachName}
        </p>
      </div>

      <div className="flex justify-between">
        {weekDays.map((day, index) => {
          const isActive = index === ACTIVE_INDEX;

          return (
            <div
              key={`${day.label}-${index}`}
              className={`flex min-w-9 flex-col items-center gap-2 rounded-[10px] py-1.5 ${
                isActive ? "bg-accent/[0.12]" : ""
              }`}
            >
              <span
                className={`font-mono text-[10px] tabular-nums ${
                  isActive
                    ? "font-bold text-accent"
                    : "font-semibold text-faint"
                }`}
              >
                {day.label}
              </span>
              <span
                className={`h-[7px] w-[7px] rounded-full ${dotToneClass[day.tone]}`}
              />
            </div>
          );
        })}
      </div>

      {session ? (
        <div className="rounded-[var(--radius)] border border-border bg-card p-[18px]">
          <div className="flex items-start gap-3.5">
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[11px] bg-accent/15">
              <Dumbbell className="h-[22px] w-[22px] text-accent" />
            </span>
            <div className="flex-1">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">
                {session.timing}
                {session.gym ? ` · ${session.gym}` : ""}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">
                {session.name}
              </h2>
              <p className="mt-1 text-[13px] text-subtle">{session.summary}</p>
            </div>
          </div>
          <div className="mt-4 flex gap-1.5">
            <span className="h-1 flex-1 rounded-full bg-accent" />
            <span className="h-1 flex-1 rounded-full bg-accent opacity-55" />
            <span className="h-1 flex-1 rounded-full bg-accent opacity-30" />
          </div>
          <Link
            href="/today"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 font-mono text-[13px] font-bold uppercase tracking-[0.08em] text-black transition-colors hover:bg-accent/90"
          >
            Go to Today
          </Link>
        </div>
      ) : (
        <div className="rounded-[var(--radius)] border border-dashed border-border px-4 py-10 text-center font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
          No plan assigned yet
        </div>
      )}

      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
        Read-only preview · clients log on their own device
      </p>
    </div>
  );
}

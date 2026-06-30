import Link from "next/link";
import { CheckCircle2, Trophy } from "lucide-react";

import type { Enums } from "@/lib/supabase/types";
import { formatWeight } from "@/lib/units";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export type WorkoutSummaryProps = {
  completedAt: string;
  prs: Array<{
    exerciseName: string;
    prId: string;
    prType: Enums<"pr_type_enum">;
    reps: number;
    weightKg: number;
  }>;
  workoutName: string;
  statusMessage?: string;
  setLogs: Array<{
    exerciseName: string;
    isBodyweight: boolean;
    reps: number;
    setLogId: string;
    weightKg: number | null;
  }>;
  wasEndedEarly: boolean;
};

function formatCompletionDate(completedAt: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(completedAt));
}

function formatPrLabel(prType: Enums<"pr_type_enum">) {
  return prType === "weight" ? "Weight PR" : "In-range rep PR";
}

function formatSetValue(setLog: WorkoutSummaryProps["setLogs"][number]) {
  if (setLog.isBodyweight || setLog.weightKg === null) {
    return `BW × ${setLog.reps}`;
  }

  return `${formatWeight(setLog.weightKg)} × ${setLog.reps}`;
}

export function WorkoutSummary({
  completedAt,
  prs,
  workoutName,
  statusMessage,
  setLogs,
  wasEndedEarly,
}: WorkoutSummaryProps) {
  const groupedSetLogs = setLogs.reduce<
    Array<{ exerciseName: string; values: string[] }>
  >((groups, setLog) => {
    const existing = groups.find(
      (group) => group.exerciseName === setLog.exerciseName,
    );

    if (existing) {
      existing.values.push(formatSetValue(setLog));
    } else {
      groups.push({
        exerciseName: setLog.exerciseName,
        values: [formatSetValue(setLog)],
      });
    }

    return groups;
  }, []);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
        <h2 className="mt-2.5 text-2xl font-semibold tracking-tight text-foreground">
          Session complete
        </h2>
        <p className="mt-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
          {workoutName} · {formatCompletionDate(completedAt)} ·{" "}
          {wasEndedEarly ? "ended early" : "all blocks complete"}
        </p>
      </div>

      {statusMessage ? (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-foreground">
          {statusMessage}
        </div>
      ) : null}

      <div className="space-y-3">
        <p className="eyebrow">Personal records · {prs.length}</p>
        {prs.length > 0 ? (
          <ul className="space-y-2">
            {prs.map((pr) => {
              const isRepPr = pr.prType === "in_range_rep";

              return (
                <li
                  key={pr.prId}
                  className={cn(
                    "flex items-center gap-3 rounded-[13px] border px-3.5 py-3",
                    isRepPr
                      ? "border-success/30 bg-success/[0.08]"
                      : "border-accent/40 bg-accent/10",
                  )}
                >
                  <Trophy
                    className={cn(
                      "h-5 w-5 shrink-0",
                      isRepPr ? "text-success" : "text-accent",
                    )}
                    fill="currentColor"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-foreground">
                      {pr.exerciseName}
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em]",
                        isRepPr ? "text-success" : "text-accent",
                      )}
                    >
                      {formatPrLabel(pr.prType)}
                    </p>
                  </div>
                  <span className="font-mono text-[15px] font-semibold tabular-nums text-foreground">
                    {formatWeight(pr.weightKg)} × {pr.reps}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No PRs were recorded for this workout.
          </p>
        )}
      </div>

      <div className="space-y-3">
        <p className="eyebrow">Logged sets</p>
        {groupedSetLogs.length > 0 ? (
          <ul className="space-y-2">
            {groupedSetLogs.map((group) => (
              <li
                key={group.exerciseName}
                className="rounded-xl border border-border bg-card px-3.5 py-3"
              >
                <p className="text-[12px] font-semibold text-subtle">
                  {group.exerciseName}
                </p>
                <p className="mt-1 font-mono text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {group.values.join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No sets were logged for this workout.
          </p>
        )}
      </div>

      <Link
        href="/today"
        className={cn(
          buttonVariants(),
          "w-full text-[13px] font-bold uppercase tracking-[0.08em]",
        )}
      >
        Done
      </Link>
    </div>
  );
}

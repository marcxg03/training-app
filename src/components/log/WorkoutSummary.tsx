import Link from "next/link";

import type { Enums } from "@/lib/supabase/types";
import { formatWeight } from "@/lib/units";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function formatPrType(prType: Enums<"pr_type_enum">) {
  return prType === "weight" ? "Type A" : "Type B";
}

export function WorkoutSummary({
  completedAt,
  prs,
  workoutName,
  statusMessage,
  setLogs,
  wasEndedEarly,
}: WorkoutSummaryProps) {
  const totalReps = setLogs.reduce((sum, setLog) => sum + setLog.reps, 0);
  const totalVolume = setLogs.reduce((sum, setLog) => {
    if (setLog.isBodyweight || setLog.weightKg === null) {
      return sum;
    }

    return sum + setLog.weightKg * setLog.reps;
  }, 0);

  return (
    <Card className="bg-card/80">
      <CardHeader className="space-y-3">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Workout Complete
        </p>
        <CardTitle className="text-3xl tracking-tight">{workoutName}</CardTitle>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>{formatCompletionDate(completedAt)}</p>
          {wasEndedEarly ? <p>Ended early</p> : <p>All blocks complete</p>}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {statusMessage ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-foreground">
            {statusMessage}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/70 bg-background/60 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Total Sets
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {setLogs.length}
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/60 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Total Reps
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {totalReps}
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/60 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Volume
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {formatWeight(totalVolume)}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            PRs This Workout
          </p>
          {prs.length > 0 ? (
            <ul className="space-y-3">
              {prs.map((pr) => (
                <li
                  key={pr.prId}
                  className="rounded-xl border border-border/70 bg-background/60 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {pr.exerciseName}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatWeight(pr.weightKg)} × {pr.reps}
                      </p>
                    </div>
                    <span className="text-xs uppercase tracking-[0.18em] text-accent">
                      {formatPrType(pr.prType)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No PRs were recorded for this workout.
            </p>
          )}
        </div>

        <Link
          href="/today"
          className={cn(buttonVariants(), "w-full sm:w-auto")}
        >
          Back to today
        </Link>
      </CardContent>
    </Card>
  );
}

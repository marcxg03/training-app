import type { JSX } from "react";

import { AllWorkoutsRow } from "@/app/(app)/history/_components/AllWorkoutsRow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAllWorkouts } from "@/lib/history/queries";

export default async function AllWorkoutsPage(): Promise<JSX.Element> {
  const rows = await getAllWorkouts();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          History
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
          All Workouts
        </h1>
      </div>

      <Card className="bg-card/80">
        <CardHeader className="space-y-2">
          <CardTitle className="text-xl tracking-tight text-foreground">
            Workout Log
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Every tracked workout completion, newest first.
          </p>
        </CardHeader>
        <CardContent>
          {rows.length > 0 ? (
            <ul className="space-y-3">
              {rows.map((row) => (
                <AllWorkoutsRow key={row.completion_id} row={row} />
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed border-border/80 px-4 py-6 text-sm leading-6 text-muted-foreground">
              No completed sessions yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

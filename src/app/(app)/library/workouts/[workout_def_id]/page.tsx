import Link from "next/link";
import { redirect } from "next/navigation";

import { BlockTypeBadge } from "@/app/(app)/library/_components/BlockTypeBadge";
import { DeleteLibraryItemButton } from "@/app/(app)/library/_components/DeleteLibraryItemButton";
import { buttonVariants } from "@/components/ui/button";
import { workoutEditHref, workoutsHref } from "@/lib/library/crossLinks";
import { formatExerciseCount } from "@/lib/library/displayName";
import { getWorkoutDefDetail } from "@/lib/library/queries";

type WorkoutDetailPageProps = {
  params: Promise<{
    workout_def_id: string;
  }>;
};

export default async function WorkoutDetailPage({
  params,
}: WorkoutDetailPageProps) {
  const { workout_def_id: workoutDefId } = await params;
  const workout = await getWorkoutDefDetail(workoutDefId);

  if (!workout) {
    redirect(workoutsHref());
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-4">
        <a
          href={workoutsHref()}
          className="inline-flex min-h-11 items-center text-sm font-medium text-accent transition-colors hover:text-accent/80"
        >
          Back to library
        </a>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Library
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {workout.name}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={workoutEditHref(workoutDefId)}
            className={buttonVariants({ variant: "outline" })}
          >
            Edit
          </Link>
          <DeleteLibraryItemButton
            kind="workout"
            id={workoutDefId}
            name={workout.name}
            redirectTo={workoutsHref()}
          />
        </div>
      </div>

      {workout.blocks.length > 0 ? (
        <ul className="space-y-3">
          {workout.blocks.map((block) => (
            <li
              key={`${block.block_id}:${block.display_order}`}
              className="rounded-2xl border border-border/70 bg-card/80 px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-foreground">
                    {block.block_name}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {formatExerciseCount(block.exercise_count)}
                  </p>
                </div>
                {block.block_type ? (
                  <BlockTypeBadge blockType={block.block_type} />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
          No blocks in this workout yet. Edit to add some.
        </p>
      )}
    </div>
  );
}

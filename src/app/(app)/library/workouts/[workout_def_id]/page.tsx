import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";

import { BlockTypeBadge } from "@/app/(app)/library/_components/BlockTypeBadge";
import { DeleteLibraryItemButton } from "@/app/(app)/library/_components/DeleteLibraryItemButton";
import { workoutEditHref, workoutsHref } from "@/lib/library/crossLinks";
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
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-3">
          <a
            href={workoutsHref()}
            aria-label="Back to library"
            className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-input text-subtle transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </a>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {workout.name}
            </h1>
            <p className="font-mono text-[11px] uppercase tabular-nums tracking-[0.1em] text-faint">
              {workout.blocks.length}{" "}
              {workout.blocks.length === 1 ? "block" : "blocks"} · in order
            </p>
          </div>
        </div>
        <Link
          href={workoutEditHref(workoutDefId)}
          className="inline-flex min-h-11 items-center gap-1.5 pt-12 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-accent transition-colors hover:text-accent/80"
        >
          <Pencil className="h-[17px] w-[17px]" />
          Edit
        </Link>
      </div>

      {workout.blocks.length > 0 ? (
        <ul className="space-y-2">
          {workout.blocks.map((block, index) => (
            <li
              key={`${block.block_id}:${block.display_order}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3.5"
            >
              <span className="w-3.5 flex-none font-mono text-xs font-semibold tabular-nums text-faint">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                {block.block_name}
              </span>
              {block.block_type ? (
                <BlockTypeBadge blockType={block.block_type} />
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-[var(--radius)] border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          No blocks in this workout yet. Edit to add some.
        </p>
      )}

      <DeleteLibraryItemButton
        kind="workout"
        id={workoutDefId}
        name={workout.name}
        redirectTo={workoutsHref()}
        variant="bar"
      />
    </div>
  );
}

import { AddWorkoutButton } from "@/app/(app)/library/_components/AddWorkoutButton";
import { EmptyState } from "@/app/(app)/library/_components/EmptyState";
import { LibraryTabs } from "@/app/(app)/library/_components/LibraryTabs";
import { WorkoutListCard } from "@/app/(app)/library/_components/WorkoutListCard";
import { getWorkoutDefs } from "@/lib/library/queries";

export default async function WorkoutsLibraryPage() {
  const workouts = await getWorkoutDefs();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Library
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Workouts
        </h1>
      </div>

      <LibraryTabs />

      {workouts.length > 0 ? (
        <div className="space-y-4">
          <AddWorkoutButton />
          <ul className="space-y-3">
            {workouts.map((workout) => (
              <WorkoutListCard key={workout.workout_def_id} workout={workout} />
            ))}
          </ul>
        </div>
      ) : (
        <div className="space-y-4">
          <EmptyState message="No workouts yet. Build one from your lifting blocks." />
          <AddWorkoutButton />
        </div>
      )}
    </div>
  );
}

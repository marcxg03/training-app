import { AddWorkoutButton } from "@/app/(owner)/library/_components/AddWorkoutButton";
import { EmptyState } from "@/app/(owner)/library/_components/EmptyState";
import { LibraryTabs } from "@/app/(owner)/library/_components/LibraryTabs";
import { WorkoutListCard } from "@/app/(owner)/library/_components/WorkoutListCard";
import { getWorkoutDefs } from "@/lib/library/queries";

export default async function WorkoutsLibraryPage() {
  const workouts = await getWorkoutDefs();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="space-y-1">
        <p className="eyebrow">Library</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Workouts
        </h1>
      </div>

      <LibraryTabs />

      {workouts.length > 0 ? (
        <div className="space-y-4">
          <ul className="space-y-2.5">
            {workouts.map((workout) => (
              <WorkoutListCard key={workout.workout_def_id} workout={workout} />
            ))}
          </ul>
          <AddWorkoutButton />
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

import { AddExerciseButton } from "@/app/(app)/library/_components/AddExerciseButton";
import { EmptyState } from "@/app/(app)/library/_components/EmptyState";
import { ExerciseListCard } from "@/app/(app)/library/_components/ExerciseListCard";
import { LibraryTabs } from "@/app/(app)/library/_components/LibraryTabs";
import { getExercises } from "@/lib/library/queries";

export default async function ExercisesLibraryPage() {
  const exercises = await getExercises();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="space-y-1">
        <p className="eyebrow">Library</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Exercises
        </h1>
      </div>

      <LibraryTabs />

      {exercises.length > 0 ? (
        <div className="space-y-4">
          <ul className="space-y-2.5">
            {exercises.map((exercise) => (
              <ExerciseListCard
                key={exercise.exercise_id}
                exercise={exercise}
              />
            ))}
          </ul>
          <AddExerciseButton />
        </div>
      ) : (
        <div className="space-y-4">
          <EmptyState message="No exercises yet." />
          <AddExerciseButton />
        </div>
      )}
    </div>
  );
}

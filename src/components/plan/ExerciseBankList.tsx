type ExerciseBankListProps = {
  exercises: Array<{
    exerciseId: string;
    name: string;
    notes: string;
    muscleGroups: string[];
  }>;
};

function formatMuscleGroups(muscleGroups: string[]) {
  return muscleGroups
    .map((group) => group.replace(/_/g, " "))
    .map((group) =>
      group.replace(/\b\w/g, (character) => character.toUpperCase()),
    )
    .join(" · ");
}

export function ExerciseBankList({ exercises }: ExerciseBankListProps) {
  return (
    <ul className="space-y-3">
      {exercises.map((exercise) => (
        <li
          key={exercise.exerciseId}
          className="rounded-xl border border-border/70 bg-background/60 px-4 py-3"
        >
          <p className="text-sm font-medium text-foreground">{exercise.name}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {formatMuscleGroups(exercise.muscleGroups)}
          </p>
          {exercise.notes ? (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {exercise.notes}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

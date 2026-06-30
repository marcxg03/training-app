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
  const primaryMuscle = exercises
    .map((exercise) => formatMuscleGroups(exercise.muscleGroups))
    .find(Boolean);

  return (
    <div className="space-y-2.5">
      <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-faint">
        Bank{primaryMuscle ? ` · ${primaryMuscle}` : ""}
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {exercises.map((exercise) => (
          <li
            key={exercise.exerciseId}
            className="rounded-md bg-input px-2.5 py-1.5 text-[11px] font-medium text-subtle"
          >
            {exercise.name}
          </li>
        ))}
      </ul>
      {exercises.some((exercise) => exercise.notes) ? (
        <ul className="space-y-1 pt-0.5">
          {exercises
            .filter((exercise) => exercise.notes)
            .map((exercise) => (
              <li
                key={`${exercise.exerciseId}-note`}
                className="text-[12px] leading-5 text-muted-foreground"
              >
                <span className="text-subtle">{exercise.name}:</span>{" "}
                {exercise.notes}
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}

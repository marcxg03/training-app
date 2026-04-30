export const HIGH_LEVEL_MUSCLE_GROUPS = [
  "chest",
  "shoulders",
  "back",
  "arms",
  "legs",
  "core",
  "calves",
] as const;

export type HighLevelMuscleGroup = (typeof HIGH_LEVEL_MUSCLE_GROUPS)[number];

const labelByGroup: Record<HighLevelMuscleGroup, string> = {
  chest: "Chest",
  shoulders: "Shoulders",
  back: "Back",
  arms: "Arms",
  legs: "Legs",
  core: "Core",
  calves: "Calves",
};

export function getHighLevelMuscleGroups(
  muscleGroups: readonly string[],
): HighLevelMuscleGroup[] {
  const normalized = new Set(
    muscleGroups.map((group) => group.trim().toLowerCase()),
  );

  return HIGH_LEVEL_MUSCLE_GROUPS.filter((group) => normalized.has(group));
}

export function getPrimaryMuscleGroupLabel(
  muscleGroups: readonly string[],
): string | null {
  const [primaryGroup] = getHighLevelMuscleGroups(muscleGroups);

  return primaryGroup ? labelByGroup[primaryGroup] : null;
}

export type DayOfWeek = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type WorkoutType = "lifting" | "cardio" | "recovery";
export type Timing = "am" | "pm" | "anytime";
export type BlockType = "failure" | "mobility" | "corrective";
export type BlockCategory = "lifting" | "cardio" | "recovery";
export type CardioFormat = "speed_run" | "endurance_run" | "basketball";
export type CardioTargetZone = "sprint" | "zone_2" | "anaerobic" | "game_pace";
export type PullSubBank = "lats" | "upper_back" | "teres_major" | "rear_delts";

export type WikiFiles = {
  overview: string;
  masterPlan: string;
  currentPlan: string;
  trainingLog: string;
  nutrition: string;
  planDecisions: string;
};

export type MarkdownTable = {
  headers: string[];
  rows: string[][];
};

export type ParsedCardioActivity = {
  name: string;
  timing: Timing;
  cardioFormat: CardioFormat;
  cardioDistance: string | null;
  cardioTargetZone: CardioTargetZone;
  description: string;
};

export type ParsedRecoveryWorkout = {
  dayOfWeek: DayOfWeek;
  workoutName: string;
  timing: Timing;
  description: string;
};

export type ParsedRecoveryActivity = {
  name: string;
  description: string;
};

export type ParsedNutritionTargets = {
  calMin: number;
  calMax: number;
  proteinMinG: number;
  proteinMaxG: number;
  carbsMinG: number;
  carbsMaxG: number;
  fatMinG: number;
  fatMaxG: number;
};

export type ParsedHistoricalPR = {
  exerciseName: string;
  prType: "weight";
  weightKg: number;
  reps: number;
};

export type ParsedExerciseSpec = {
  name: string;
  notes: string;
  prescribedMin: number;
  prescribedMax: number;
  muscleGroups: string[];
  isCompound: boolean;
  displayOrder: number;
  pullSubBank?: PullSubBank;
};

export type ParsedBlock = {
  blockName: string;
  blockType: BlockType;
  displayOrder: number;
  // Adjustable per-block set-scheme (D4/D9/D15). Additive; defaults reproduce the
  // legacy WU + W1 + W2 (1 warm-up + 2 working) behaviour. `toFailure` says the
  // last working set is taken to failure. Rep ranges stay on the exercises.
  warmupSets: number;
  workingSets: number;
  toFailure: boolean;
  exercises: ParsedExerciseSpec[];
};

export type ParsedWorkoutBlockRef = {
  blockName: string;
  blockCategory: BlockCategory;
  displayOrder: number;
  presetActivityName: string | null;
  presetActivityType: "cardio" | "recovery" | null;
};

export type ParsedWorkoutSpec = {
  workoutName: string;
  workoutType: WorkoutType;
  timing: Timing;
  gym: string | null;
  description: string | null;
  displayOrder: number;
  cardioFormat: CardioFormat | null;
  cardioDistance: string | null;
  cardioTargetZone: CardioTargetZone | null;
  blocks: ParsedBlock[];
  blockRefs: ParsedWorkoutBlockRef[];
  focusMuscleGroups: string[];
};

export type ParsedDaySpec = {
  dayOfWeek: DayOfWeek;
  dayLabel: string;
  isRestDay: boolean;
  workouts: ParsedWorkoutSpec[];
};

export type ParsedWeeklyDay = {
  dayOfWeek: DayOfWeek;
  dayLabel: string;
  isRestDay: boolean;
  gym: string | null;
  workoutEntries: Array<{
    workoutName: string;
    workoutType: WorkoutType;
    timing: Timing;
  }>;
  recoveryLabels: string[];
};

export type ParsedWeeklySchedule = {
  days: ParsedWeeklyDay[];
};

export type ValidationResult = {
  hardViolations: string[];
  softWarnings: string[];
};

export type TrainingPlanSpec = {
  name: string;
  overviewTitle: string | null;
  masterPlanTitle: string | null;
  days: ParsedDaySpec[];
  liftingBlocks: ParsedBlock[];
  cardioActivities: ParsedCardioActivity[];
  recoveryActivities: ParsedRecoveryActivity[];
  cardioBlockName: string;
  recoveryBlockName: string;
  nutritionTargets: ParsedNutritionTargets;
  historicalPrs: ParsedHistoricalPR[];
  validation: ValidationResult;
};

export type DayOfWeek = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type SessionType = "lifting" | "cardio" | "recovery";
export type Timing = "am" | "pm" | "anytime";
export type BlockType = "failure" | "mobility" | "corrective";
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

export type ParsedCardioSession = {
  sessionName: string;
  timing: Timing;
  cardioFormat: CardioFormat;
  cardioDistance: string | null;
  cardioTargetZone: CardioTargetZone;
  description: string;
};

export type ParsedRecoverySession = {
  dayOfWeek: DayOfWeek;
  sessionName: string;
  timing: Timing;
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
  exercises: ParsedExerciseSpec[];
};

export type ParsedSessionSpec = {
  sessionName: string;
  sessionType: SessionType;
  timing: Timing;
  gym: string | null;
  description: string | null;
  displayOrder: number;
  cardioFormat: CardioFormat | null;
  cardioDistance: string | null;
  cardioTargetZone: CardioTargetZone | null;
  blocks: ParsedBlock[];
  focusMuscleGroups: string[];
};

export type ParsedDaySpec = {
  dayOfWeek: DayOfWeek;
  dayLabel: string;
  isRestDay: boolean;
  sessions: ParsedSessionSpec[];
};

export type ParsedWeeklyDay = {
  dayOfWeek: DayOfWeek;
  dayLabel: string;
  isRestDay: boolean;
  gym: string | null;
  sessionEntries: Array<{
    sessionName: string;
    sessionType: SessionType;
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
  nutritionTargets: ParsedNutritionTargets;
  historicalPrs: ParsedHistoricalPR[];
  validation: ValidationResult;
};

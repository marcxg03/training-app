export type LiftingBlockSummary = {
  block_id: string;
  block_name: string;
  block_type: "failure" | "mobility" | "corrective";
  exercise_count: number;
};

export type LiftingExerciseInBlock = {
  exercise_id: string;
  name: string;
  prescribed_min: number;
  prescribed_max: number;
  muscle_groups: string[];
  is_bodyweight: boolean;
  notes: string;
  display_order: number;
};

export type LiftingBlockDetail = {
  block_id: string;
  block_name: string;
  block_type: "failure" | "mobility" | "corrective";
  exercises: LiftingExerciseInBlock[];
};

export type CardioActivity = {
  activity_id: string;
  name: string;
  cardio_format: "speed_run" | "endurance_run" | "basketball";
  cardio_distance: string | null;
  cardio_target_zone: "sprint" | "zone_2" | "anaerobic" | "game_pace";
  description: string | null;
};

export type CardioBlockWithActivities = {
  block_id: string;
  block_name: string;
  activities: CardioActivity[];
};

export type RecoveryActivity = {
  activity_id: string;
  name: string;
  description: string | null;
};

export type RecoveryBlockWithActivities = {
  block_id: string;
  block_name: string;
  activities: RecoveryActivity[];
};

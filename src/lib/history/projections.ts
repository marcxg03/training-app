export type PRTimelineRow = {
  pr_id: string;
  achieved_at: string;
  exercise_id: string;
  exercise_name: string;
  pr_type: "weight" | "in_range_rep";
  weight_kg: number;
  reps: number;
  is_bodyweight: boolean;
  set_log_id: string;
  completion_id: string;
  workout_display_name: string;
};

export type AllWorkoutsRow = {
  completion_id: string;
  workout_display_name: string;
  started_at: string;
  state: "complete" | "in_progress" | "ended_early";
  blocks_completed_count: number;
  blocks_total_count: number;
  pr_count: number;
};

export type ExerciseProgressionPoint = {
  set_log_id: string;
  logged_at: string;
  weight_kg: number | null;
  reps: number;
  is_to_failure: boolean;
  is_pr: boolean;
};

export type ExerciseProgressionPR = {
  pr_id: string;
  pr_type: "weight" | "in_range_rep";
  weight_kg: number;
  reps: number;
  achieved_at: string;
};

export type ExerciseProgression = {
  exercise_id: string;
  exercise_name: string;
  is_bodyweight: boolean;
  // Same-origin illustration for the page header, when the exercise has one.
  // NULL for most of the library (T2-B) — the UI must degrade without it.
  media_path: string | null;
  media_type: string | null;
  best_weight_pr: ExerciseProgressionPR | null;
  best_in_range_pr: ExerciseProgressionPR | null;
  prs: ExerciseProgressionPR[];
  // Chronological oldest -> newest top set per session, for the chart.
  top_sets: ExerciseProgressionPoint[];
  // Chronological newest -> oldest individual sets, for the recent-sets list.
  recent_sets: ExerciseProgressionPoint[];
};

export type CompletedSessionSet = {
  set_log_id: string;
  set_index: number;
  weight_kg: number | null;
  reps: number;
  is_to_failure: boolean;
  is_pr: boolean;
  pr_type: "weight" | "in_range_rep" | null;
};

export type CompletedSessionGroup = {
  block_id: string;
  block_name: string;
  exercise_id: string;
  exercise_name: string;
  sets: CompletedSessionSet[];
};

export type CompletedSession = {
  completion_id: string;
  workout_display_name: string;
  workout_name: string;
  started_at: string;
  completed_at: string | null;
  state: "complete" | "in_progress" | "ended_early";
  duration_seconds: number | null;
  total_volume_kg: number;
  pr_count: number;
  set_count: number;
  blocks_completed_count: number;
  blocks_total_count: number;
  groups: CompletedSessionGroup[];
};

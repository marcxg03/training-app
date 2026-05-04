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
  session_display_name: string;
};

export type AllSessionsRow = {
  completion_id: string;
  session_display_name: string;
  started_at: string;
  state: "complete" | "in_progress" | "ended_early";
  blocks_completed_count: number;
  blocks_total_count: number;
  pr_count: number;
};

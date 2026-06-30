// =============================================================================
// MOCK DATA — coaching backend not yet built.
// To be replaced by a Supabase-backed slice (Codex). Do NOT use as a real
// data source. These types describe the *shape* the coaching UI expects; the
// real schema/RLS will be designed in a later phase (see REDESIGN_BRIEF §8).
// =============================================================================

/** Goal modes mirror the athlete nutrition goal modes for reuse when wired. */
export type CoachGoalMode = "cut" | "maintain" | "lean_bulk";

/** Relationship state of a client to the coach. */
export type CoachClientStatus = "active" | "invited" | "paused";

export type CoachClient = {
  id: string;
  name: string;
  email: string;
  /** 1–2 letter monogram for the avatar tile. */
  avatarInitials: string;
  status: CoachClientStatus;
  goalMode: CoachGoalMode;
  /** Human-readable last-activity label, e.g. "Today", "5 days ago". */
  lastActiveLabel: string;
  /** Session adherence for the current week, 0–100. */
  adherencePct: number;
  /** Completed vs assigned sessions this week (for the "2/6 wk" pill). */
  sessionsCompleted: number;
  sessionsAssigned: number;
  /** Name of the plan currently assigned, or null if none yet. */
  assignedPlanName: string | null;
  /** PRs hit in the trailing 30 days. */
  recentPRCount: number;
  /** True when the coach should check in (behind / missed sessions). */
  needsAttention: boolean;
};

export type CoachNote = {
  id: string;
  clientId: string;
  body: string;
  createdAtLabel: string;
  /** Notes are client-visible by design; flag kept explicit for the UI. */
  clientVisible: boolean;
  /** True when the note is a reply authored by the client (chat thread). */
  fromClient?: boolean;
};

export type ActivityKind = "pr" | "completed" | "missed" | "joined";

export type ActivityItem = {
  id: string;
  clientName: string;
  kind: ActivityKind;
  label: string;
  timeLabel: string;
  /** Coarse bucket used to group the feed chronologically. */
  bucket: "today" | "earlier";
};

/** A single point on a client's progress chart (adherence / sessions per wk). */
export type ProgressPoint = {
  dateLabel: string;
  value: number;
};

export type ClientPR = {
  id: string;
  exerciseName: string;
  /** Pre-formatted result, e.g. "245×5". */
  result: string;
  /** Tone hint for the trophy icon. */
  tone: "accent" | "success";
};

export type ClientProgress = {
  /** Weekly adherence series (sessions completed per week). */
  adherenceSeries: ProgressPoint[];
  fuelAdherencePct: number;
  recentPRCount: number;
  trendingUp: boolean;
  recentPRs: ClientPR[];
};

/** A plan option shown in the Assign Training picker. */
export type AssignablePlan = {
  id: string;
  name: string;
  workoutCount: number;
  trainDays: number;
};

/** A weekly schedule slot for the Assign Training screen. */
export type ScheduleSlot = {
  day: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
  /** Workout assigned to this day, or null for a rest day. */
  workoutName: string | null;
};

export type ClientAssignment = {
  /** Plans available from the coach's library. */
  plans: AssignablePlan[];
  /** Id of the plan currently selected for this client, or null. */
  selectedPlanId: string | null;
  schedule: ScheduleSlot[];
};

export type MacroRange = {
  label: string;
  min: number;
  max: number;
};

export type ClientTargets = {
  goalMode: CoachGoalMode;
  calMin: number;
  calMax: number;
  macros: MacroRange[];
};

/** Static preview of a coach-authored Today session (Frame 47). */
export type ClientTodaySession = {
  id: string;
  name: string;
  workoutType: "lifting" | "cardio";
  timing: string;
  gym: string | null;
  summary: string;
};

/** The coached client's view of their coach (Frame 48). */
export type ClientCoachRelationship = {
  coachName: string;
  coachInitials: string;
  sinceLabel: string;
  assignedPlanName: string;
  targetsSummary: string;
  notes: CoachNote[];
};

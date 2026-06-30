// =============================================================================
// MOCK DATA — coaching backend not yet built.
// To be replaced by a Supabase-backed slice (Codex). Do NOT use as a real
// data source. Every getter below is a pure, synchronous function returning
// hard-coded sample data so the coaching UI can be built and reviewed ahead of
// the data layer (see REDESIGN_BRIEF §8). NO Supabase, NO async, NO new deps.
// =============================================================================

import type {
  ActivityItem,
  ClientAssignment,
  ClientCoachRelationship,
  ClientProgress,
  ClientTargets,
  ClientTodaySession,
  CoachClient,
  CoachNote,
} from "@/lib/coach/types";

const ROSTER: CoachClient[] = [
  {
    id: "maya-khan",
    name: "Maya Khan",
    email: "maya@example.com",
    avatarInitials: "MK",
    status: "active",
    goalMode: "cut",
    lastActiveLabel: "5 days ago",
    adherencePct: 33,
    sessionsCompleted: 2,
    sessionsAssigned: 6,
    assignedPlanName: "Full Body — 3 day",
    recentPRCount: 0,
    needsAttention: true,
  },
  {
    id: "dre-thomas",
    name: "Dre Thomas",
    email: "dre@example.com",
    avatarInitials: "DT",
    status: "active",
    goalMode: "lean_bulk",
    lastActiveLabel: "Today",
    adherencePct: 100,
    sessionsCompleted: 6,
    sessionsAssigned: 6,
    assignedPlanName: "Upper / Lower — 6 day",
    recentPRCount: 7,
    needsAttention: false,
  },
  {
    id: "sam-lee",
    name: "Sam Lee",
    email: "sam@example.com",
    avatarInitials: "SL",
    status: "active",
    goalMode: "maintain",
    lastActiveLabel: "1 day ago",
    adherencePct: 83,
    sessionsCompleted: 5,
    sessionsAssigned: 6,
    assignedPlanName: "Upper / Lower — 6 day",
    recentPRCount: 1,
    needsAttention: false,
  },
  {
    id: "priya-n",
    name: "Priya N.",
    email: "priya@example.com",
    avatarInitials: "PN",
    status: "invited",
    goalMode: "maintain",
    lastActiveLabel: "Invite sent · not yet accepted",
    adherencePct: 0,
    sessionsCompleted: 0,
    sessionsAssigned: 0,
    assignedPlanName: null,
    recentPRCount: 0,
    needsAttention: false,
  },
];

/** Empty roster used by the Roster Empty state (Frame 39). */
export const EMPTY_ROSTER: CoachClient[] = [];

const NOTES: Record<string, CoachNote[]> = {
  "dre-thomas": [
    {
      id: "note-1",
      clientId: "dre-thomas",
      body: "Great push this week — squat PR was clean. Add a back-off set on Fridays and keep RPE ~8 on top sets.",
      createdAtLabel: "Jun 28 · 9:12 AM",
      clientVisible: true,
    },
    {
      id: "note-2",
      clientId: "dre-thomas",
      body: "Protein's been landing under range on rest days. Aim for a shake mid-afternoon.",
      createdAtLabel: "Jun 24 · 6:40 PM",
      clientVisible: true,
    },
    {
      id: "note-3",
      clientId: "dre-thomas",
      body: "Thanks coach — felt strong. Will do.",
      createdAtLabel: "Dre · Jun 28",
      clientVisible: true,
      fromClient: true,
    },
  ],
  "maya-khan": [
    {
      id: "note-4",
      clientId: "maya-khan",
      body: "Noticed you missed a couple sessions — everything ok? Let's drop to 4 days this week and rebuild momentum.",
      createdAtLabel: "Jun 27 · 8:02 AM",
      clientVisible: true,
    },
  ],
  "sam-lee": [
    {
      id: "note-5",
      clientId: "sam-lee",
      body: "Solid consistency. Let's add a top single on bench next block to test 1RM.",
      createdAtLabel: "Jun 25 · 7:15 PM",
      clientVisible: true,
    },
  ],
};

const ACTIVITY: ActivityItem[] = [
  {
    id: "act-1",
    clientName: "Dre",
    kind: "pr",
    label: "hit a Back Squat PR · 245×5",
    timeLabel: "2h ago",
    bucket: "today",
  },
  {
    id: "act-2",
    clientName: "Sam",
    kind: "completed",
    label: "completed Upper Day",
    timeLabel: "4h ago",
    bucket: "today",
  },
  {
    id: "act-3",
    clientName: "Maya",
    kind: "missed",
    label: "missed 2 scheduled sessions",
    timeLabel: "Needs a check-in",
    bucket: "earlier",
  },
  {
    id: "act-4",
    clientName: "Priya",
    kind: "joined",
    label: "was invited",
    timeLabel: "Yesterday · pending",
    bucket: "earlier",
  },
];

const PROGRESS: Record<string, ClientProgress> = {
  "dre-thomas": {
    adherenceSeries: [
      { dateLabel: "W1", value: 4 },
      { dateLabel: "W2", value: 5 },
      { dateLabel: "W3", value: 3 },
      { dateLabel: "W4", value: 5 },
      { dateLabel: "W5", value: 6 },
      { dateLabel: "W6", value: 5 },
      { dateLabel: "W7", value: 6 },
      { dateLabel: "W8", value: 6 },
    ],
    fuelAdherencePct: 88,
    recentPRCount: 7,
    trendingUp: true,
    recentPRs: [
      {
        id: "pr-1",
        exerciseName: "Back Squat",
        result: "245×5",
        tone: "accent",
      },
      {
        id: "pr-2",
        exerciseName: "Bench Press",
        result: "185×8",
        tone: "success",
      },
    ],
  },
  "maya-khan": {
    adherenceSeries: [
      { dateLabel: "W1", value: 5 },
      { dateLabel: "W2", value: 4 },
      { dateLabel: "W3", value: 4 },
      { dateLabel: "W4", value: 3 },
      { dateLabel: "W5", value: 3 },
      { dateLabel: "W6", value: 2 },
      { dateLabel: "W7", value: 3 },
      { dateLabel: "W8", value: 2 },
    ],
    fuelAdherencePct: 61,
    recentPRCount: 0,
    trendingUp: false,
    recentPRs: [],
  },
  "sam-lee": {
    adherenceSeries: [
      { dateLabel: "W1", value: 4 },
      { dateLabel: "W2", value: 5 },
      { dateLabel: "W3", value: 5 },
      { dateLabel: "W4", value: 6 },
      { dateLabel: "W5", value: 5 },
      { dateLabel: "W6", value: 5 },
      { dateLabel: "W7", value: 6 },
      { dateLabel: "W8", value: 5 },
    ],
    fuelAdherencePct: 79,
    recentPRCount: 1,
    trendingUp: true,
    recentPRs: [
      { id: "pr-3", exerciseName: "Deadlift", result: "315×3", tone: "accent" },
    ],
  },
};

const ASSIGNMENTS: Record<string, ClientAssignment> = {
  "dre-thomas": {
    plans: [
      {
        id: "upper-lower",
        name: "Upper / Lower — 6 day",
        workoutCount: 2,
        trainDays: 6,
      },
      {
        id: "full-body",
        name: "Full Body — 3 day",
        workoutCount: 1,
        trainDays: 3,
      },
    ],
    selectedPlanId: "upper-lower",
    schedule: [
      { day: "mon", workoutName: "Upper Day" },
      { day: "tue", workoutName: "Lower Day" },
      { day: "wed", workoutName: "Upper Day" },
      { day: "thu", workoutName: "Lower Day" },
      { day: "fri", workoutName: "Upper Day" },
      { day: "sat", workoutName: "Lower Day" },
      { day: "sun", workoutName: null },
    ],
  },
};

const DEFAULT_ASSIGNMENT: ClientAssignment = {
  plans: [
    {
      id: "upper-lower",
      name: "Upper / Lower — 6 day",
      workoutCount: 2,
      trainDays: 6,
    },
    {
      id: "full-body",
      name: "Full Body — 3 day",
      workoutCount: 1,
      trainDays: 3,
    },
  ],
  selectedPlanId: null,
  schedule: [
    { day: "mon", workoutName: null },
    { day: "tue", workoutName: null },
    { day: "wed", workoutName: null },
    { day: "thu", workoutName: null },
    { day: "fri", workoutName: null },
    { day: "sat", workoutName: null },
    { day: "sun", workoutName: null },
  ],
};

const TARGETS: Record<string, ClientTargets> = {
  "dre-thomas": {
    goalMode: "lean_bulk",
    calMin: 2400,
    calMax: 2700,
    macros: [
      { label: "Protein", min: 180, max: 220 },
      { label: "Carbs", min: 250, max: 310 },
      { label: "Fat", min: 65, max: 85 },
    ],
  },
};

const DEFAULT_TARGETS: ClientTargets = {
  goalMode: "maintain",
  calMin: 2100,
  calMax: 2400,
  macros: [
    { label: "Protein", min: 160, max: 200 },
    { label: "Carbs", min: 200, max: 250 },
    { label: "Fat", min: 60, max: 80 },
  ],
};

const CLIENT_TODAY_SESSION: ClientTodaySession = {
  id: "client-today-upper",
  name: "Upper Day",
  workoutType: "lifting",
  timing: "PM · 6:00",
  gym: "Iron House",
  summary: "5 lifts · Bench, Row, OHP, Pull-up, Curl",
};

const MY_COACH: ClientCoachRelationship = {
  coachName: "Marcus Gao",
  coachInitials: "MG",
  sinceLabel: "Coaching you since Mar 2026",
  assignedPlanName: "Upper / Lower — 6 day",
  targetsSummary: "Lean bulk · 2,400–2,700 kcal",
  notes: NOTES["dre-thomas"],
};

// --- Pure synchronous getters --------------------------------------------------

export function getRoster(): CoachClient[] {
  return ROSTER;
}

export function getClient(id: string): CoachClient | null {
  return ROSTER.find((client) => client.id === id) ?? null;
}

export function getClientNotes(id: string): CoachNote[] {
  return NOTES[id] ?? [];
}

export function getActivityFeed(): ActivityItem[] {
  return ACTIVITY;
}

const EMPTY_PROGRESS: ClientProgress = {
  adherenceSeries: [],
  fuelAdherencePct: 0,
  recentPRCount: 0,
  trendingUp: false,
  recentPRs: [],
};

export function getClientProgress(id: string): ClientProgress {
  // Fall back to zeroed progress (not another client's data) when a known
  // client has no progress record yet.
  return PROGRESS[id] ?? EMPTY_PROGRESS;
}

export function getClientAssignment(id: string): ClientAssignment {
  return ASSIGNMENTS[id] ?? DEFAULT_ASSIGNMENT;
}

export function getClientTargets(id: string): ClientTargets {
  return TARGETS[id] ?? DEFAULT_TARGETS;
}

export function getClientTodaySession(): ClientTodaySession {
  return CLIENT_TODAY_SESSION;
}

export function getMyCoach(): ClientCoachRelationship {
  return MY_COACH;
}

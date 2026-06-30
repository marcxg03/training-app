// =============================================================================
// Coaching data layer (server reads). Returns the view-model shapes in
// ./types.ts so the coaching pages/components stay presentational.
//
// Access model:
//   * Coaching tables (coach_clients, coach_notes, coach_client_targets) are
//     read with the session client and protected by RLS.
//   * A client's own private data (logs, PRs, schedule, profile) is read with
//     the service-role admin client — but ONLY after the caller is verified as
//     that client's coach via `assertCoachClient`. The relationship check runs
//     on the RLS-protected session client, so a non-coach can never reach a
//     client's data through here.
// No React imports.
// =============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database, Tables } from "@/lib/supabase/types";
import { formatPrResult, relativeActivityLabel } from "@/lib/coach/labels";
import type {
  ActivityItem,
  ClientAssignment,
  ClientCoachRelationship,
  ClientProgress,
  ClientPR,
  ClientTargets,
  ClientTodaySession,
  CoachClient,
  CoachNote,
} from "@/lib/coach/types";

type AdminClient = SupabaseClient<Database>;
type CoachClientRow = Tables<"coach_clients">;

const DAY_MS = 24 * 60 * 60 * 1000;
const ATTENTION_STALE_DAYS = 7;

export const DEFAULT_CLIENT_TARGETS: ClientTargets = {
  goalMode: "maintain",
  calMin: 2100,
  calMax: 2400,
  macros: [
    { label: "Protein", min: 160, max: 200 },
    { label: "Carbs", min: 200, max: 250 },
    { label: "Fat", min: 60, max: 80 },
  ],
};

// --- shared helpers ----------------------------------------------------------

async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Resolve a relationship the current user coaches. Returns null when the row
 * does not exist or the caller is not its coach — the gate for every
 * service-role read below.
 */
export async function assertCoachClient(
  relationshipId: string,
): Promise<CoachClientRow | null> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();
  if (!userId) {
    return null;
  }

  const { data, error } = await supabase
    .from("coach_clients")
    .select("*")
    .eq("relationship_id", relationshipId)
    .eq("coach_user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load client relationship: ${error.message}`);
  }

  return data;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Monday-anchored start of the week containing `date`. */
function startOfWeek(date: Date): Date {
  const start = startOfDay(date);
  const mondayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayOffset);
  return start;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function displayNameFor(
  row: CoachClientRow,
  profileName: string | null | undefined,
): string {
  return profileName?.trim() || row.invite_name?.trim() || row.invite_email;
}

// --- per-client metrics ------------------------------------------------------

type ClientMetrics = {
  lastActiveAt: string | null;
  sessionsCompletedThisWeek: number;
  sessionsAssigned: number;
  recentPRCount: number;
};

const EMPTY_METRICS: ClientMetrics = {
  lastActiveAt: null,
  sessionsCompletedThisWeek: 0,
  sessionsAssigned: 0,
  recentPRCount: 0,
};

/**
 * Batch-compute roster metrics for a set of linked client user ids using the
 * admin client. Callers must have verified coach ownership of these clients.
 */
async function computeClientMetrics(
  admin: AdminClient,
  clientUserIds: string[],
  now: Date,
): Promise<Map<string, ClientMetrics>> {
  const result = new Map<string, ClientMetrics>();
  if (clientUserIds.length === 0) {
    return result;
  }

  const weekStart = startOfWeek(now).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS).toISOString();
  const sixtyDaysAgo = new Date(now.getTime() - 60 * DAY_MS).toISOString();

  const [completionsRes, prRes, plansRes] = await Promise.all([
    admin
      .from("workout_completions")
      .select("user_id, started_at, completed_at")
      .in("user_id", clientUserIds)
      .gte("started_at", sixtyDaysAgo),
    admin
      .from("pr_history")
      .select("user_id, achieved_at")
      .in("user_id", clientUserIds)
      .gte("achieved_at", thirtyDaysAgo),
    admin
      .from("training_plans")
      .select("plan_id, user_id")
      .in("user_id", clientUserIds)
      .eq("is_active", true),
  ]);

  for (const res of [completionsRes, prRes, plansRes]) {
    if (res.error) {
      throw new Error(`Failed to load client metrics: ${res.error.message}`);
    }
  }

  // sessions assigned = non-rest days in the client's active plan
  const planIdToUser = new Map<string, string>();
  for (const plan of plansRes.data ?? []) {
    planIdToUser.set(plan.plan_id, plan.user_id);
  }
  const assignedByUser = new Map<string, number>();
  if (planIdToUser.size > 0) {
    const { data: schedules, error: schedulesError } = await admin
      .from("daily_schedules")
      .select("plan_id, is_rest_day")
      .in("plan_id", [...planIdToUser.keys()]);
    if (schedulesError) {
      throw new Error(
        `Failed to load client schedules: ${schedulesError.message}`,
      );
    }
    for (const schedule of schedules ?? []) {
      if (schedule.is_rest_day) {
        continue;
      }
      const userId = planIdToUser.get(schedule.plan_id);
      if (userId) {
        assignedByUser.set(userId, (assignedByUser.get(userId) ?? 0) + 1);
      }
    }
  }

  const completedThisWeek = new Map<string, number>();
  const lastActive = new Map<string, string>();
  for (const completion of completionsRes.data ?? []) {
    const at = completion.completed_at ?? completion.started_at;
    const prev = lastActive.get(completion.user_id);
    if (!prev || at > prev) {
      lastActive.set(completion.user_id, at);
    }
    if (completion.completed_at && completion.completed_at >= weekStart) {
      completedThisWeek.set(
        completion.user_id,
        (completedThisWeek.get(completion.user_id) ?? 0) + 1,
      );
    }
  }

  const prCount = new Map<string, number>();
  for (const pr of prRes.data ?? []) {
    prCount.set(pr.user_id, (prCount.get(pr.user_id) ?? 0) + 1);
  }

  for (const id of clientUserIds) {
    result.set(id, {
      lastActiveAt: lastActive.get(id) ?? null,
      sessionsCompletedThisWeek: completedThisWeek.get(id) ?? 0,
      sessionsAssigned: assignedByUser.get(id) ?? 0,
      recentPRCount: prCount.get(id) ?? 0,
    });
  }

  return result;
}

function toCoachClient(
  row: CoachClientRow,
  profileName: string | null | undefined,
  metrics: ClientMetrics,
  now: Date,
): CoachClient {
  const name = displayNameFor(row, profileName);
  const lastActiveDays = metrics.lastActiveAt
    ? Math.floor(
        (startOfDay(now).getTime() -
          startOfDay(new Date(metrics.lastActiveAt)).getTime()) /
          DAY_MS,
      )
    : null;

  const behind =
    metrics.sessionsAssigned > 0 &&
    metrics.sessionsCompletedThisWeek / metrics.sessionsAssigned < 0.5;
  const stale =
    lastActiveDays !== null && lastActiveDays > ATTENTION_STALE_DAYS;

  return {
    id: row.relationship_id,
    name,
    email: row.invite_email,
    avatarInitials: initials(name),
    status: row.status,
    goalMode: row.goal_mode ?? "maintain",
    lastActiveLabel:
      row.status === "invited"
        ? "Invite sent · not yet accepted"
        : relativeActivityLabel(metrics.lastActiveAt, now),
    adherencePct:
      metrics.sessionsAssigned > 0
        ? Math.round(
            (metrics.sessionsCompletedThisWeek / metrics.sessionsAssigned) *
              100,
          )
        : 0,
    sessionsCompleted: metrics.sessionsCompletedThisWeek,
    sessionsAssigned: metrics.sessionsAssigned,
    assignedPlanName: row.assigned_plan_name,
    recentPRCount: metrics.recentPRCount,
    needsAttention: row.status === "active" && (behind || stale),
  };
}

// --- public reads ------------------------------------------------------------

export async function getRoster(): Promise<CoachClient[]> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();
  if (!userId) {
    return [];
  }

  const { data: rows, error } = await supabase
    .from("coach_clients")
    .select("*")
    .eq("coach_user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load roster: ${error.message}`);
  }
  if (!rows || rows.length === 0) {
    return [];
  }

  const now = new Date();
  const admin = createAdminClient();
  const clientIds = rows
    .map((row) => row.client_user_id)
    .filter((id): id is string => id !== null);

  const [metrics, profileNames] = await Promise.all([
    computeClientMetrics(admin, clientIds, now),
    fetchProfileNames(admin, clientIds),
  ]);

  return rows.map((row) =>
    toCoachClient(
      row,
      row.client_user_id ? profileNames.get(row.client_user_id) : null,
      (row.client_user_id && metrics.get(row.client_user_id)) || EMPTY_METRICS,
      now,
    ),
  );
}

async function fetchProfileNames(
  admin: AdminClient,
  userIds: string[],
): Promise<Map<string, string | null>> {
  const names = new Map<string, string | null>();
  if (userIds.length === 0) {
    return names;
  }
  const { data, error } = await admin
    .from("profiles")
    .select("user_id, display_name")
    .in("user_id", userIds);
  if (error) {
    throw new Error(`Failed to load client profiles: ${error.message}`);
  }
  for (const profile of data ?? []) {
    names.set(profile.user_id, profile.display_name);
  }
  return names;
}

export async function getClient(
  relationshipId: string,
): Promise<CoachClient | null> {
  const row = await assertCoachClient(relationshipId);
  if (!row) {
    return null;
  }

  const now = new Date();
  const admin = createAdminClient();
  const clientIds = row.client_user_id ? [row.client_user_id] : [];
  const [metrics, profileNames] = await Promise.all([
    computeClientMetrics(admin, clientIds, now),
    fetchProfileNames(admin, clientIds),
  ]);

  return toCoachClient(
    row,
    row.client_user_id ? profileNames.get(row.client_user_id) : null,
    (row.client_user_id && metrics.get(row.client_user_id)) || EMPTY_METRICS,
    now,
  );
}

function formatNoteTimestamp(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
    .format(new Date(iso))
    .replace(",", " ·");
}

export async function getClientNotes(
  relationshipId: string,
): Promise<CoachNote[]> {
  const row = await assertCoachClient(relationshipId);
  if (!row) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_notes")
    .select(
      "note_id, relationship_id, author, body, client_visible, created_at",
    )
    .eq("relationship_id", relationshipId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load coach notes: ${error.message}`);
  }

  return (data ?? []).map((note) => ({
    id: note.note_id,
    clientId: note.relationship_id,
    body: note.body,
    createdAtLabel: formatNoteTimestamp(note.created_at),
    clientVisible: note.client_visible,
    fromClient: note.author === "client",
  }));
}

export async function getClientProgress(
  relationshipId: string,
): Promise<ClientProgress> {
  const empty: ClientProgress = {
    adherenceSeries: [],
    fuelAdherencePct: 0,
    recentPRCount: 0,
    trendingUp: false,
    recentPRs: [],
  };

  const row = await assertCoachClient(relationshipId);
  if (!row || !row.client_user_id) {
    return empty;
  }

  const clientId = row.client_user_id;
  const now = new Date();
  const admin = createAdminClient();
  const eightWeeksAgo = new Date(now.getTime() - 56 * DAY_MS);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * DAY_MS);

  const [completionsRes, prRes, mealsRes] = await Promise.all([
    admin
      .from("workout_completions")
      .select("completed_at")
      .eq("user_id", clientId)
      .not("completed_at", "is", null)
      .gte("completed_at", eightWeeksAgo.toISOString()),
    admin
      .from("pr_history")
      .select("pr_id, exercise_id, pr_type, reps, weight_kg, achieved_at")
      .eq("user_id", clientId)
      .gte("achieved_at", thirtyDaysAgo.toISOString())
      .order("achieved_at", { ascending: false }),
    admin
      .from("meal_entries")
      .select("date")
      .eq("user_id", clientId)
      .gte("date", fourteenDaysAgo.toISOString().slice(0, 10)),
  ]);

  for (const res of [completionsRes, prRes, mealsRes]) {
    if (res.error) {
      throw new Error(`Failed to load client progress: ${res.error.message}`);
    }
  }

  // 8-week adherence series (completed sessions per week, oldest → newest).
  const firstWeekStart = startOfWeek(eightWeeksAgo);
  const weekCounts = new Array(8).fill(0) as number[];
  for (const completion of completionsRes.data ?? []) {
    if (!completion.completed_at) {
      continue;
    }
    const index = Math.floor(
      (startOfWeek(new Date(completion.completed_at)).getTime() -
        firstWeekStart.getTime()) /
        (7 * DAY_MS),
    );
    if (index >= 0 && index < 8) {
      weekCounts[index] += 1;
    }
  }
  const adherenceSeries = weekCounts.map((value, index) => ({
    dateLabel: `W${index + 1}`,
    value,
  }));
  const firstHalf = weekCounts.slice(0, 4).reduce((a, b) => a + b, 0);
  const secondHalf = weekCounts.slice(4).reduce((a, b) => a + b, 0);

  // Fuel adherence proxy: share of the last 14 days with a meal logged.
  const daysWithMeals = new Set((mealsRes.data ?? []).map((meal) => meal.date))
    .size;
  const fuelAdherencePct = Math.round((daysWithMeals / 14) * 100);

  // Recent PRs: name + bodyweight flag come from the client's exercises.
  const prRows = prRes.data ?? [];
  const exerciseIds = [...new Set(prRows.map((pr) => pr.exercise_id))];
  const exerciseInfo = await fetchExerciseInfo(admin, exerciseIds);
  const recentPRs: ClientPR[] = prRows.slice(0, 6).map((pr, index) => {
    const info = exerciseInfo.get(pr.exercise_id);
    return {
      id: pr.pr_id,
      exerciseName: info?.name ?? "Exercise",
      result: formatPrResult(
        pr.weight_kg,
        pr.reps,
        info?.isBodyweight ?? false,
      ),
      tone: index % 2 === 0 ? "accent" : "success",
    };
  });

  return {
    adherenceSeries,
    fuelAdherencePct,
    recentPRCount: prRows.length,
    trendingUp: secondHalf >= firstHalf,
    recentPRs,
  };
}

async function fetchExerciseInfo(
  admin: AdminClient,
  exerciseIds: string[],
): Promise<Map<string, { name: string; isBodyweight: boolean }>> {
  const info = new Map<string, { name: string; isBodyweight: boolean }>();
  if (exerciseIds.length === 0) {
    return info;
  }
  const { data, error } = await admin
    .from("exercises")
    .select("exercise_id, name, is_bodyweight")
    .in("exercise_id", exerciseIds);
  if (error) {
    throw new Error(`Failed to load exercise names: ${error.message}`);
  }
  for (const exercise of data ?? []) {
    info.set(exercise.exercise_id, {
      name: exercise.name,
      isBodyweight: exercise.is_bodyweight,
    });
  }
  return info;
}

export async function getClientTargets(
  relationshipId: string,
): Promise<ClientTargets> {
  const row = await assertCoachClient(relationshipId);
  if (!row) {
    return DEFAULT_CLIENT_TARGETS;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_client_targets")
    .select("*")
    .eq("relationship_id", relationshipId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load client targets: ${error.message}`);
  }
  if (!data) {
    return { ...DEFAULT_CLIENT_TARGETS, goalMode: row.goal_mode ?? "maintain" };
  }

  return targetsRowToView(data);
}

function targetsRowToView(row: Tables<"coach_client_targets">): ClientTargets {
  return {
    goalMode: row.goal_mode,
    calMin: row.cal_min,
    calMax: row.cal_max,
    macros: [
      { label: "Protein", min: row.protein_min_g, max: row.protein_max_g },
      { label: "Carbs", min: row.carbs_min_g, max: row.carbs_max_g },
      { label: "Fat", min: row.fat_min_g, max: row.fat_max_g },
    ],
  };
}

export async function getClientAssignment(
  relationshipId: string,
): Promise<ClientAssignment> {
  const row = await assertCoachClient(relationshipId);
  const empty: ClientAssignment = {
    plans: [],
    selectedPlanId: null,
    schedule: buildEmptySchedule(),
  };
  if (!row) {
    return empty;
  }

  const supabase = await createClient();
  const userId = await getCurrentUserId();
  if (!userId) {
    return empty;
  }

  // The coach's own library plans (RLS allows reading own training_plans).
  const { data: plans, error: plansError } = await supabase
    .from("training_plans")
    .select("plan_id, name")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (plansError) {
    throw new Error(`Failed to load coach plans: ${plansError.message}`);
  }

  const planIds = (plans ?? []).map((plan) => plan.plan_id);
  const scheduleByPlan = await fetchPlanScheduleCounts(supabase, planIds);

  const assignablePlans = (plans ?? []).map((plan) => {
    const counts = scheduleByPlan.get(plan.plan_id);
    return {
      id: plan.plan_id,
      name: plan.name,
      workoutCount: counts?.workoutCount ?? 0,
      trainDays: counts?.trainDays ?? 0,
    };
  });

  const selectedPlanId = row.assigned_plan_id;
  const schedule = selectedPlanId
    ? await fetchPlanScheduleSlots(supabase, selectedPlanId)
    : buildEmptySchedule();

  return { plans: assignablePlans, selectedPlanId, schedule };
}

const WEEK_ORDER: Database["public"]["Enums"]["day_of_week_enum"][] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

function buildEmptySchedule(): ClientAssignment["schedule"] {
  return WEEK_ORDER.map((day) => ({ day, workoutName: null }));
}

type SessionClient = Awaited<ReturnType<typeof createClient>>;

async function fetchPlanScheduleCounts(
  supabase: SessionClient,
  planIds: string[],
): Promise<Map<string, { workoutCount: number; trainDays: number }>> {
  const counts = new Map<string, { workoutCount: number; trainDays: number }>();
  if (planIds.length === 0) {
    return counts;
  }

  const { data: schedules, error } = await supabase
    .from("daily_schedules")
    .select("schedule_id, plan_id, is_rest_day, workouts(workout_id)")
    .in("plan_id", planIds);

  if (error) {
    throw new Error(`Failed to load plan schedules: ${error.message}`);
  }

  for (const schedule of schedules ?? []) {
    const entry = counts.get(schedule.plan_id) ?? {
      workoutCount: 0,
      trainDays: 0,
    };
    const workouts = (schedule.workouts ?? []) as { workout_id: string }[];
    entry.workoutCount += workouts.length;
    if (!schedule.is_rest_day) {
      entry.trainDays += 1;
    }
    counts.set(schedule.plan_id, entry);
  }

  return counts;
}

async function fetchPlanScheduleSlots(
  supabase: SessionClient,
  planId: string,
): Promise<ClientAssignment["schedule"]> {
  const { data: schedules, error } = await supabase
    .from("daily_schedules")
    .select("day_of_week, is_rest_day, workouts(workout_name, display_order)")
    .eq("plan_id", planId);

  if (error) {
    throw new Error(`Failed to load plan schedule: ${error.message}`);
  }

  const byDay = new Map<string, string | null>();
  for (const schedule of schedules ?? []) {
    const workouts = (schedule.workouts ?? []) as {
      workout_name: string;
      display_order: number;
    }[];
    if (schedule.is_rest_day || workouts.length === 0) {
      byDay.set(schedule.day_of_week, null);
      continue;
    }
    const first = [...workouts].sort(
      (a, b) => a.display_order - b.display_order,
    )[0];
    byDay.set(schedule.day_of_week, first.workout_name);
  }

  return WEEK_ORDER.map((day) => ({
    day,
    workoutName: byDay.get(day) ?? null,
  }));
}

// --- activity feed -----------------------------------------------------------

export async function getActivityFeed(): Promise<ActivityItem[]> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();
  if (!userId) {
    return [];
  }

  const { data: rows, error } = await supabase
    .from("coach_clients")
    .select("*")
    .eq("coach_user_id", userId);

  if (error) {
    throw new Error(`Failed to load roster for activity: ${error.message}`);
  }

  const now = new Date();
  const items: ActivityItem[] = [];
  const linked = (rows ?? []).filter(
    (row): row is CoachClientRow & { client_user_id: string } =>
      row.client_user_id !== null,
  );

  // Pending invites surface as "joined/invited" activity.
  for (const row of rows ?? []) {
    if (row.status === "invited") {
      items.push({
        id: `invite-${row.relationship_id}`,
        clientName: firstName(displayNameFor(row, null)),
        kind: "joined",
        label: "was invited",
        timeLabel: "Pending",
        bucket: "earlier",
      });
    }
  }

  if (linked.length > 0) {
    const admin = createAdminClient();
    const clientIds = linked.map((row) => row.client_user_id);
    const profileNames = await fetchProfileNames(admin, clientIds);
    const nameByUser = new Map<string, string>();
    for (const row of linked) {
      nameByUser.set(
        row.client_user_id,
        firstName(displayNameFor(row, profileNames.get(row.client_user_id))),
      );
    }

    const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS).toISOString();
    const [prRes, completionsRes] = await Promise.all([
      admin
        .from("pr_history")
        .select(
          "pr_id, user_id, exercise_id, pr_type, reps, weight_kg, achieved_at",
        )
        .in("user_id", clientIds)
        .gte("achieved_at", sevenDaysAgo)
        .order("achieved_at", { ascending: false })
        .limit(20),
      admin
        .from("workout_completions")
        .select("completion_id, user_id, completed_at")
        .in("user_id", clientIds)
        .not("completed_at", "is", null)
        .gte("completed_at", sevenDaysAgo)
        .order("completed_at", { ascending: false })
        .limit(20),
    ]);

    for (const res of [prRes, completionsRes]) {
      if (res.error) {
        throw new Error(`Failed to load activity: ${res.error.message}`);
      }
    }

    const exerciseIds = [
      ...new Set((prRes.data ?? []).map((pr) => pr.exercise_id)),
    ];
    const exerciseInfo = await fetchExerciseInfo(admin, exerciseIds);

    for (const pr of prRes.data ?? []) {
      const info = exerciseInfo.get(pr.exercise_id);
      items.push({
        id: `pr-${pr.pr_id}`,
        clientName: nameByUser.get(pr.user_id) ?? "Client",
        kind: "pr",
        label: `hit a ${info?.name ?? "lift"} PR · ${formatPrResult(pr.weight_kg, pr.reps, info?.isBodyweight ?? false)}`,
        timeLabel: relativeActivityLabel(pr.achieved_at, now),
        bucket: bucketFor(pr.achieved_at, now),
      });
    }

    for (const completion of completionsRes.data ?? []) {
      if (!completion.completed_at) {
        continue;
      }
      items.push({
        id: `done-${completion.completion_id}`,
        clientName: nameByUser.get(completion.user_id) ?? "Client",
        kind: "completed",
        label: "completed a workout",
        timeLabel: relativeActivityLabel(completion.completed_at, now),
        bucket: bucketFor(completion.completed_at, now),
      });
    }
  }

  // Stable order: today first, then earlier; PRs above completions within.
  const kindRank: Record<ActivityItem["kind"], number> = {
    pr: 0,
    completed: 1,
    missed: 2,
    joined: 3,
  };
  return items.sort((a, b) => {
    if (a.bucket !== b.bucket) {
      return a.bucket === "today" ? -1 : 1;
    }
    return kindRank[a.kind] - kindRank[b.kind];
  });
}

function bucketFor(iso: string, now: Date): ActivityItem["bucket"] {
  return new Date(iso) >= startOfDay(now) ? "today" : "earlier";
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

// --- client-side (the coached athlete's own view) ----------------------------

/**
 * The current user's relationship with their coach (if any). Uses the admin
 * client to read the coach's display name — gated by the verified fact that the
 * caller is this relationship's client.
 */
export async function getMyCoach(): Promise<ClientCoachRelationship | null> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();
  if (!userId) {
    return null;
  }

  const { data: rel, error } = await supabase
    .from("coach_clients")
    .select("*")
    .eq("client_user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load coach relationship: ${error.message}`);
  }
  if (!rel) {
    return null;
  }

  const admin = createAdminClient();
  const [{ data: coachProfile }, { data: targets }, { data: notes }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("display_name")
        .eq("user_id", rel.coach_user_id)
        .maybeSingle(),
      supabase
        .from("coach_client_targets")
        .select("*")
        .eq("relationship_id", rel.relationship_id)
        .maybeSingle(),
      supabase
        .from("coach_notes")
        .select(
          "note_id, relationship_id, author, body, client_visible, created_at",
        )
        .eq("relationship_id", rel.relationship_id)
        .order("created_at", { ascending: true }),
    ]);

  const coachName = coachProfile?.display_name?.trim() || "Your coach";
  const targetsView = targets ? targetsRowToView(targets) : null;

  return {
    coachName,
    coachInitials: initials(coachName),
    sinceLabel: `Coaching you since ${formatMonthYear(rel.created_at)}`,
    assignedPlanName: rel.assigned_plan_name ?? "Not assigned yet",
    targetsSummary: targetsView
      ? `${capitalize(targetsView.goalMode.replace("_", " "))} · ${targetsView.calMin.toLocaleString()}–${targetsView.calMax.toLocaleString()} kcal`
      : "No targets set yet",
    notes: (notes ?? []).map((note) => ({
      id: note.note_id,
      clientId: note.relationship_id,
      body: note.body,
      createdAtLabel: formatNoteTimestamp(note.created_at),
      clientVisible: note.client_visible,
      fromClient: note.author === "client",
    })),
  };
}

/**
 * Link any pending invites for the signed-in user's email (read-path variant,
 * no cache revalidation) so a coached athlete's My Coach view resolves on first
 * visit. Safe no-op when there are none.
 */
export async function linkPendingInvites(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("link_pending_coach_invites");
  if (error) {
    throw new Error(`Failed to link coach invites: ${error.message}`);
  }
}

/** Lightweight preview of the client's assigned plan for the client-today page. */
export async function getClientTodaySession(): Promise<ClientTodaySession | null> {
  const coach = await getMyCoach();
  if (!coach || coach.assignedPlanName === "Not assigned yet") {
    return null;
  }

  return {
    id: "assigned-plan",
    name: coach.assignedPlanName,
    workoutType: "lifting",
    timing: "Assigned by your coach",
    gym: null,
    summary: "Open Today to follow and log your assigned session.",
  };
}

function formatMonthYear(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

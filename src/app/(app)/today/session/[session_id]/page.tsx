import type { QueryData } from "@supabase/supabase-js";
import Link from "next/link";
import { redirect } from "next/navigation";

import type { Enums } from "@/lib/supabase/types";
import { SessionDetailPanel } from "@/components/plan/SessionDetailPanel";
import { StartWorkoutButton } from "@/components/today/StartWorkoutButton";
import { getTodayDayOfWeek } from "@/lib/methodology/today";
import { createClient } from "@/lib/supabase/server";

type TodaySessionDetailPageProps = {
  params: Promise<{
    session_id: string;
  }>;
};

async function getTodaySessionDetail(
  sessionId: string,
  dayOfWeek: Enums<"day_of_week_enum">,
) {
  const supabase = await createClient();
  const query = supabase
    .from("daily_schedules")
    .select(
      `
        day_of_week,
        training_plans!inner (
          is_active
        ),
        sessions!inner (
          session_id,
          session_type,
          session_name,
          timing,
          gym,
          description,
          cardio_distance,
          cardio_target_zone,
          display_order,
          blocks (
            block_id,
            block_name,
            block_type,
            display_order,
            block_exercises (
              display_order,
              exercises (
                exercise_id,
                name,
                notes,
                muscle_groups
              )
            )
          )
        )
      `,
    )
    .eq("day_of_week", dayOfWeek)
    .eq("training_plans.is_active", true)
    .eq("sessions.session_id", sessionId)
    .maybeSingle();

  type TodaySessionRecord = QueryData<typeof query>;

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load today's session: ${error.message}`);
  }

  if (!data || !data.sessions || data.sessions.length === 0) {
    return null;
  }

  const record: TodaySessionRecord = data;
  const [session] = record.sessions;

  if (!session) {
    return null;
  }

  const blocks = [...(session.blocks ?? [])]
    .sort((left, right) => left.display_order - right.display_order)
    .map((block) => ({
      blockId: block.block_id,
      blockName: block.block_name,
      blockType: block.block_type,
      exercises: [...(block.block_exercises ?? [])]
        .sort((left, right) => left.display_order - right.display_order)
        .flatMap((row) => row.exercises ?? [])
        .map((exercise) => ({
          exerciseId: exercise.exercise_id,
          name: exercise.name,
          notes: exercise.notes,
          muscleGroups: exercise.muscle_groups,
        })),
    }));

  return {
    sessionId: session.session_id,
    sessionType: session.session_type,
    sessionName: session.session_name,
    timing: session.timing,
    gym: session.gym,
    description: session.description,
    cardioDistance: session.cardio_distance,
    cardioTargetZone: session.cardio_target_zone,
    blocks,
  };
}

export default async function TodaySessionDetailPage({
  params,
}: TodaySessionDetailPageProps) {
  const { session_id: sessionId } = await params;
  const dayOfWeek = getTodayDayOfWeek();
  const session = await getTodaySessionDetail(sessionId, dayOfWeek);

  if (!session) {
    redirect("/today");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-3">
        <Link
          href="/today"
          className="text-sm font-medium text-accent transition-colors hover:text-accent/80"
        >
          Back to today
        </Link>
        {session.sessionType === "lifting" ? (
          <StartWorkoutButton sessionId={session.sessionId} />
        ) : null}
      </div>
      <SessionDetailPanel session={session} />
    </div>
  );
}

import type { Enums } from "@/lib/supabase/types";
import { BlockList } from "@/components/plan/BlockList";
import { ExerciseBankList } from "@/components/plan/ExerciseBankList";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type SessionDetailPanelProps = {
  session: {
    workoutId: string;
    workoutType: Enums<"session_type_enum">;
    sessionName: string;
    timing: Enums<"timing_enum">;
    gym: string | null;
    description: string | null;
    cardioDistance: string | null;
    cardioTargetZone: Enums<"cardio_target_zone_enum"> | null;
    blocks: Array<{
      blockId: string;
      blockName: string;
      blockType: Enums<"block_type_enum">;
      exercises: Array<{
        exerciseId: string;
        name: string;
        notes: string;
        muscleGroups: string[];
      }>;
    }>;
  };
};

function formatTimingLabel(timing: Enums<"timing_enum">) {
  if (timing === "anytime") {
    return "Anytime";
  }

  return timing.toUpperCase();
}

function formatZoneLabel(zone: Enums<"cardio_target_zone_enum"> | null) {
  if (!zone) {
    return null;
  }

  return zone
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function buildCardioMetaLine(session: SessionDetailPanelProps["session"]) {
  const parts = [
    session.cardioDistance,
    formatZoneLabel(session.cardioTargetZone),
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : null;
}

export function SessionDetailPanel({ session }: SessionDetailPanelProps) {
  const cardioMetaLine = buildCardioMetaLine(session);

  return (
    <Card className="bg-card/80">
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 pb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            {session.workoutType}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            {session.sessionName}
          </h2>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-foreground">
            {formatTimingLabel(session.timing)}
          </p>
          {session.gym ? (
            <p className="mt-1 text-sm text-muted-foreground">{session.gym}</p>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {session.workoutType === "lifting" ? (
          <BlockList
            blocks={session.blocks.map((block) => ({
              blockId: block.blockId,
              blockName: block.blockName,
              blockType: block.blockType,
              bank: (
                <ExerciseBankList
                  exercises={block.exercises.map((exercise) => ({
                    exerciseId: exercise.exerciseId,
                    name: exercise.name,
                    notes: exercise.notes,
                    muscleGroups: exercise.muscleGroups,
                  }))}
                />
              ),
            }))}
          />
        ) : (
          <div className="space-y-3">
            {cardioMetaLine ? (
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {cardioMetaLine}
              </p>
            ) : null}
            <p className="text-sm leading-7 text-muted-foreground">
              {session.description ?? "No extra details for this session."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

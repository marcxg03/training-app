import type { Enums } from "@/lib/supabase/types";
import { BlockList } from "@/components/plan/BlockList";
import { ExerciseBankList } from "@/components/plan/ExerciseBankList";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

const workoutTypeLabel: Record<Enums<"session_type_enum">, string> = {
  lifting: "Lift",
  cardio: "Cardio",
  recovery: "Recovery",
};

const typeChipClass: Record<Enums<"session_type_enum">, string> = {
  lifting: "bg-accent/[0.16] text-accent",
  cardio: "bg-cardio/[0.14] text-cardio",
  recovery: "bg-success/[0.14] text-success",
};

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
    /** Preset cardio/recovery activity attached to this session, if any. */
    activityName?: string | null;
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

  const blockCount = session.blocks.length;

  return (
    <Card className="bg-card">
      <CardHeader className="space-y-4 pb-4">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-md px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em]",
              typeChipClass[session.workoutType],
            )}
          >
            {workoutTypeLabel[session.workoutType]}
          </span>
          <span className="inline-flex items-center rounded-md border border-border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tabular-nums tracking-[0.12em] text-subtle">
            {formatTimingLabel(session.timing)}
          </span>
          {session.gym ? (
            <span className="ml-auto font-mono text-[11px] tracking-[0.04em] text-faint">
              {session.gym.toUpperCase()}
            </span>
          ) : null}
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          {session.sessionName}
        </h2>
        {session.workoutType === "lifting" && blockCount > 0 ? (
          <p className="eyebrow">
            {blockCount} {blockCount === 1 ? "block" : "blocks"}
          </p>
        ) : null}
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
            {session.activityName ? (
              <p className="text-sm font-semibold text-foreground">
                {session.activityName}
              </p>
            ) : null}
            {cardioMetaLine ? (
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {cardioMetaLine}
              </p>
            ) : null}
            <p className="text-sm leading-7 text-muted-foreground">
              {session.description ??
                (session.activityName
                  ? "No extra details for this activity."
                  : "No extra details for this session.")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

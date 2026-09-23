import type { JSX } from "react";

import { VolumeBarChart } from "@/components/shared/VolumeBarChart";
import type { MuscleGroupVolume } from "@/lib/analytics/projections";
import { formatMuscleGroupLabel } from "@/lib/library/displayName";
import { formatTonnage } from "@/lib/units";

// One small-multiple per muscle group: sets/week bars (the programming-
// relevant metric), current-week sets and range tonnage as header stats.
function GroupCard({ group }: { group: MuscleGroupVolume }): JSX.Element {
  const label = formatMuscleGroupLabel(group.muscle_group);
  const points = group.weeks.map((week) => ({
    label: week.label,
    value: week.sets,
  }));

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="truncate text-sm font-medium text-foreground">{label}</p>
        <p className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-foreground">
          {group.currentWeekSets}
          <span className="ml-1.5 text-[10px] font-normal uppercase text-faint">
            sets this wk
          </span>
          <span className="ml-2 text-[11px] text-subtle">
            {formatTonnage(group.totalTonnageKg)}
          </span>
        </p>
      </div>
      <VolumeBarChart
        points={points}
        unitLabel="SETS / WEEK"
        ariaLabel={`${group.muscle_group} weekly set volume`}
      />
    </div>
  );
}

export function WeeklyVolumeSection({
  groups,
}: {
  groups: MuscleGroupVolume[];
}): JSX.Element {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="eyebrow mt-2">Training load · weekly sets</h2>
      {groups.length > 0 ? (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <GroupCard key={group.muscle_group} group={group} />
          ))}
        </div>
      ) : (
        <div className="rounded-[var(--radius)] border border-dashed border-border bg-card px-4 py-6 text-sm leading-6 text-muted-foreground">
          Log some sets and weekly volume per muscle group will appear here.
        </div>
      )}
    </section>
  );
}

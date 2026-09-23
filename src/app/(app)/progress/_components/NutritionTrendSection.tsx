import type { JSX } from "react";

import { BandChart } from "@/components/shared/BandChart";
import type { NutritionBandSeries } from "@/lib/analytics/projections";
import type { NutritionTargets } from "@/lib/nutrition/projections";

// Two band charts — calories and protein — with the user's target range
// drawn as a dashed reference zone. Band width = estimator uncertainty
// (min ≠ max when the meal came from the AI estimate).
function TrendCard({
  title,
  avg,
  unit,
  points,
  targetZone,
}: {
  title: string;
  avg: number | null;
  unit: string;
  points: NutritionBandSeries["calories"];
  targetZone: { min: number; max: number } | null;
}): JSX.Element {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-foreground">
          {avg ?? "—"}
          <span className="ml-1.5 text-[10px] font-normal uppercase text-faint">
            avg {unit}/day
          </span>
        </p>
      </div>
      <BandChart
        points={points}
        targetZone={targetZone}
        unitLabel={
          targetZone
            ? `${unit.toUpperCase()} · DASHED = TARGET ZONE`
            : unit.toUpperCase()
        }
        ariaLabel={`${title} 30-day trend`}
      />
    </div>
  );
}

export function NutritionTrendSection({
  series,
  targets,
}: {
  series: NutritionBandSeries;
  targets: NutritionTargets | null;
}): JSX.Element {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="eyebrow mt-2">Fuel · 30-day trend</h2>
      {series.calories.length > 0 ? (
        <div className="flex flex-col gap-4">
          <TrendCard
            title="Calories"
            avg={series.avgCaloriesMid}
            unit="kcal"
            points={series.calories}
            targetZone={
              targets ? { min: targets.cal_min, max: targets.cal_max } : null
            }
          />
          <TrendCard
            title="Protein"
            avg={series.avgProteinMid}
            unit="g"
            points={series.protein}
            targetZone={
              targets
                ? { min: targets.protein_min_g, max: targets.protein_max_g }
                : null
            }
          />
        </div>
      ) : (
        <div className="rounded-[var(--radius)] border border-dashed border-border bg-card px-4 py-6 text-sm leading-6 text-muted-foreground">
          Log some meals and your calorie + protein trends will appear here.
        </div>
      )}
    </section>
  );
}

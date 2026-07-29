"use client";

import { useState, useTransition, type JSX } from "react";
import { useRouter } from "next/navigation";

import { ProgressionChart } from "@/components/shared/ProgressionChart";
import type { TrendPoint } from "@/lib/analytics/projections";
import {
  BODYWEIGHT_MAX_LBS,
  BODYWEIGHT_MIN_LBS,
  logBodyweight,
} from "@/lib/bodyweight/mutations";
import { createClient } from "@/lib/supabase/client";
import { kgToLbs, toLbsChartPoints } from "@/lib/units";

// One-tap quick log + trend line. points arrive in kg (TrendPoint
// convention); conversion happens once at the chart boundary.
export function BodyweightSection({
  points,
  available,
  logDate,
}: {
  points: TrendPoint[];
  available: boolean;
  /** Today per the APP clock (profile timezone), authored server-side. */
  logDate: string;
}): JSX.Element {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const chartPoints = toLbsChartPoints(points);
  const current = chartPoints[chartPoints.length - 1]?.value ?? null;
  const rawKgDelta =
    points.length > 1
      ? points[points.length - 1].value - points[0].value
      : 0;
  const delta =
    Math.round(kgToLbs(Math.abs(rawKgDelta))) * Math.sign(rawKgDelta);
  const deltaLabel =
    points.length > 1 ? `${delta >= 0 ? "+" : ""}${delta} lbs` : null;

  // The WHOLE submit runs inside the transition (React 19 async transition):
  // isPending then covers the two network round-trips, so the button disables
  // during the save — not only during the post-save refresh.
  function submit() {
    startTransition(async () => {
      setError(null);
      setWarning(null);
      const weightLbs = Number(value);
      const supabase = createClient();
      const result = await logBodyweight(supabase, weightLbs, logDate);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      // Partial success (profile sync failed) is still a successful log:
      // clear the input and refresh the chart; surface the warning as
      // non-blocking text.
      setWarning(result.warning ?? null);
      setValue("");
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="eyebrow mt-2">Body · weight</h2>

      {!available ? (
        <div className="rounded-[var(--radius)] border border-dashed border-border bg-card px-4 py-6 text-sm leading-6 text-muted-foreground">
          Bodyweight tracking needs database migration 021 applied
          (supabase/migrations/021_bodyweight_logs.sql).
        </div>
      ) : (
        <>
          <div className="mb-0.5 flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Bodyweight</p>
            <p className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-foreground">
              {current ?? "—"}
              <span className="ml-1.5 text-[10px] font-normal uppercase text-faint">
                lbs
              </span>
              {deltaLabel ? (
                <span
                  className={`ml-2 text-[11px] ${delta <= 0 ? "text-accent" : "text-subtle"}`}
                >
                  {deltaLabel}
                </span>
              ) : null}
            </p>
          </div>

          <ProgressionChart
            points={chartPoints}
            unitLabel="LBS BODYWEIGHT"
            ariaLabel="Bodyweight trend"
          />

          <form
            action={submit}
            className="flex items-center gap-2"
          >
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min={BODYWEIGHT_MIN_LBS}
              max={BODYWEIGHT_MAX_LBS}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="Today's weight (lbs)"
              aria-label="Today's bodyweight in pounds"
              className="h-11 flex-1 rounded-[var(--radius)] border border-border bg-card-alt px-3.5 font-mono text-sm tabular-nums text-foreground placeholder:font-sans placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <button
              type="submit"
              disabled={isPending || value.trim() === ""}
              className="h-11 shrink-0 rounded-[var(--radius)] bg-accent px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-foreground transition-opacity disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Log"}
            </button>
          </form>

          {error ? (
            <p className="text-sm leading-5 text-warning">{error}</p>
          ) : null}
          {warning ? (
            <p className="text-sm leading-5 text-subtle">{warning}</p>
          ) : null}
        </>
      )}
    </section>
  );
}

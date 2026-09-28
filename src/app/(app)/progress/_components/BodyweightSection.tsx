"use client";

import { useState, useTransition, type JSX } from "react";
import { CalendarDays } from "lucide-react";
import { useRouter } from "next/navigation";

import { ProgressionChart } from "@/components/shared/ProgressionChart";
import type { TrendPoint } from "@/lib/analytics/projections";
import { normalizeLogDate } from "@/lib/bodyweight/log-date";
import {
  BODYWEIGHT_MAX_LBS,
  BODYWEIGHT_MIN_LBS,
  logBodyweight,
  syncCurrentBodyweight,
} from "@/lib/bodyweight/mutations";
import { createClient } from "@/lib/supabase/client";
import { kgToLbs, toLbsChartPoints } from "@/lib/units";

// Quick log + trend line, inside the Progress → Trends "Body" area (D29 — log
// where you see the trend). points arrive in kg (TrendPoint convention);
// conversion happens once at the chart boundary, and STORAGE stays kg.
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
  // Blank = today. The field only appears when the user asks for it, so the
  // common case stays two taps: type the number, hit Log.
  const [dateOpen, setDateOpen] = useState(false);
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const chartPoints = toLbsChartPoints(points);
  const current = chartPoints[chartPoints.length - 1]?.value ?? null;
  const rawKgDelta =
    points.length > 1 ? points[points.length - 1].value - points[0].value : 0;
  const delta =
    Math.round(kgToLbs(Math.abs(rawKgDelta))) * Math.sign(rawKgDelta);
  const deltaLabel =
    points.length > 1 ? `${delta >= 0 ? "+" : ""}${delta} lbs` : null;

  // The WHOLE submit runs inside the transition (React 19 async transition):
  // isPending then covers the network round-trips, so the button disables
  // during the save — not only during the post-save refresh.
  function submit() {
    startTransition(async () => {
      setError(null);
      setWarning(null);

      const resolved = normalizeLogDate(date, logDate);

      if (!resolved.ok) {
        setError(resolved.error);
        return;
      }

      const weightLbs = Number(value);
      const supabase = createClient();
      const result = await logBodyweight(supabase, weightLbs, resolved.date);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      // logBodyweight points profiles.bodyweight_kg at whatever it just wrote.
      // For a BACK-DATED entry that is wrong — "current" must stay the newest
      // log — so re-derive it. Today's log needs no correction.
      let syncWarning: string | undefined;

      if (resolved.date !== logDate) {
        syncWarning = (await syncCurrentBodyweight(supabase)).warning;
      }

      // Partial success (profile sync failed) is still a successful log:
      // clear the input and refresh the chart; surface the warning as
      // non-blocking text.
      setWarning(result.warning ?? syncWarning ?? null);
      setValue("");
      setDate("");
      setDateOpen(false);
      router.refresh();
    });
  }

  return (
    // Sub-heading style, NOT a second .eyebrow: the "Body" area header above
    // is the eyebrow, and stacking two identical mono-caps labels flattened
    // the hierarchy into noise. This mirrors NutritionTrendSection, where one
    // eyebrow ("Fuel · 30-day trend") heads two `text-sm font-medium` cards.
    <section className="flex flex-col gap-2.5">
      {!available ? (
        <>
          <h3 className="text-sm font-medium text-foreground">Bodyweight</h3>
          <div className="rounded-[var(--radius)] border border-dashed border-border bg-card px-4 py-6 text-sm leading-6 text-muted-foreground">
            Bodyweight tracking needs database migration 021 applied
            (supabase/migrations/021_bodyweight_logs.sql).
          </div>
        </>
      ) : (
        <>
          <div className="mb-0.5 flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-medium text-foreground">Bodyweight</h3>
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

          <form action={submit} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min={BODYWEIGHT_MIN_LBS}
                max={BODYWEIGHT_MAX_LBS}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="Today's weight (lbs)"
                aria-label="Bodyweight in pounds"
                className="h-11 flex-1 rounded-[var(--radius)] border border-border bg-card-alt px-3.5 font-mono text-sm tabular-nums text-foreground placeholder:font-sans placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                type="button"
                onClick={() => setDateOpen((open) => !open)}
                aria-expanded={dateOpen}
                aria-label="Log this weight for another day"
                title="Log this weight for another day"
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius)] border border-border transition-colors ${
                  dateOpen
                    ? "bg-card-alt text-foreground"
                    : "bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <CalendarDays className="h-4 w-4" />
              </button>
              <button
                type="submit"
                disabled={isPending || value.trim() === ""}
                className="h-11 shrink-0 rounded-[var(--radius)] bg-accent px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-foreground transition-opacity disabled:opacity-50"
              >
                {isPending ? "Saving…" : "Log"}
              </button>
            </div>

            {dateOpen ? (
              <label className="flex items-center gap-2 text-[11px] leading-5 text-muted-foreground">
                <span className="shrink-0">Date</span>
                <input
                  type="date"
                  value={date}
                  max={logDate}
                  onChange={(event) => setDate(event.target.value)}
                  aria-label="Date this weight was taken"
                  className="h-10 flex-1 rounded-[var(--radius)] border border-border bg-card-alt px-3 font-mono text-sm tabular-nums text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <span className="shrink-0 text-faint">
                  blank = today ({logDate})
                </span>
              </label>
            ) : null}
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

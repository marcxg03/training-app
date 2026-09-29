"use client";

import Link from "next/link";

import { useMemo, useState } from "react";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { useDiscardChangesGuard } from "@/components/shared/DiscardChangesDialog";
import { MoveButton } from "@/app/(owner)/library/_components/MoveButton";
import { WorkoutPicker } from "@/app/(app)/plan/_components/WorkoutPicker";
import { Checkbox } from "@/components/ui/checkbox";
import { savePlan } from "@/lib/plan/mutations";
import type { Enums } from "@/lib/supabase/types";
import type { PlanEditData, SessionOption } from "@/lib/plan/projections";
import { createClient } from "@/lib/supabase/client";

type PlanEditFormProps = {
  data: PlanEditData;
  /** Links each day at the day editor, for the things only it can set —
   * timing, gym, and a lifting session's individual blocks. Adding a session
   * of any kind now happens here (T3-G). */
  planId: string;
};

// T3-C: save and cancel used to `router.push("/plan")` — a MEMBER route —
// which dropped the owner out of the builder with no way back, the same dead
// end D44 fixed for the Library. They now return to the program list.

type Row = {
  workout_id: string | null;
  workout_def_id: string | null;
  name: string;
  has_history: boolean;
  /** T3-G — a cardio/recovery session carries its activity, not a definition. */
  kind?: "workout" | "cardio" | "recovery";
  preset_activity_id?: string | null;
  cardio_format?: Enums<"cardio_format_enum"> | null;
  category_block_id?: string | null;
};

type DayState = {
  schedule_id: string;
  day_of_week: Enums<"day_of_week_enum">;
  is_rest_day: boolean;
  rows: Row[];
  removed: string[];
};

const DAY_LABELS: Record<Enums<"day_of_week_enum">, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export function PlanEditForm({ data, planId }: PlanEditFormProps) {
  const router = useRouter();
  const [days, setDays] = useState<DayState[]>(() =>
    data.days.map((day) => ({
      schedule_id: day.schedule_id,
      day_of_week: day.day_of_week,
      is_rest_day: day.is_rest_day,
      rows: day.workouts.map((w) => ({
        workout_id: w.workout_id,
        workout_def_id: w.workout_def_id,
        name: w.name,
        has_history: w.has_history,
      })),
      removed: [],
    })),
  );
  const [dirty, setDirty] = useState(false);
  const [pickerDay, setPickerDay] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { discardDialog, requestConfirmation } = useDiscardChangesGuard({
    isDirty: dirty,
  });

  const catalogName = useMemo(
    () => new Map(data.catalog.map((w) => [w.workout_def_id, w.name] as const)),
    [data.catalog],
  );

  const mutate = (next: DayState[]) => {
    setDays(next);
    setDirty(true);
  };

  const toggleRest = (dayIndex: number, value: boolean) => {
    mutate(
      days.map((day, i) =>
        i === dayIndex ? { ...day, is_rest_day: value } : day,
      ),
    );
  };

  /**
   * Add any session kind to a day (T3-G).
   *
   * A workout carries its definition id; a cardio or recovery session carries
   * the activity plus the category block it hangs on, because those have no
   * definition — the session IS the activity. `savePlan` branches on `kind`.
   */
  const addSession = (dayIndex: number, option: SessionOption) => {
    const row =
      option.kind === "workout"
        ? {
            workout_id: null,
            workout_def_id: option.id,
            name: catalogName.get(option.id) ?? "Workout",
            has_history: false,
            kind: "workout" as const,
          }
        : {
            workout_id: null,
            workout_def_id: null,
            name: option.name,
            has_history: false,
            kind: option.kind,
            preset_activity_id: option.id,
            cardio_format:
              option.kind === "cardio" ? option.cardio_format : null,
            category_block_id:
              option.kind === "cardio"
                ? data.cardioBlockId
                : data.recoveryBlockId,
          };

    mutate(
      days.map((day, i) =>
        i === dayIndex ? { ...day, rows: [...day.rows, row] } : day,
      ),
    );
  };

  const removeRow = (dayIndex: number, rowIndex: number) => {
    mutate(
      days.map((day, i) => {
        if (i !== dayIndex) {
          return day;
        }
        const row = day.rows[rowIndex];
        return {
          ...day,
          rows: day.rows.filter((_, r) => r !== rowIndex),
          removed: row.workout_id
            ? [...day.removed, row.workout_id]
            : day.removed,
        };
      }),
    );
  };

  const moveRow = (dayIndex: number, rowIndex: number, delta: -1 | 1) => {
    const target = rowIndex + delta;
    mutate(
      days.map((day, i) => {
        if (i !== dayIndex || target < 0 || target >= day.rows.length) {
          return day;
        }
        const rows = [...day.rows];
        [rows[rowIndex], rows[target]] = [rows[target], rows[rowIndex]];
        return { ...day, rows };
      }),
    );
  };

  const goBack = () => router.push("/admin/programs");

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const result = await savePlan(
      createClient(),
      days.map((day) => ({
        schedule_id: day.schedule_id,
        is_rest_day: day.is_rest_day,
        rows: day.rows.map((row) => ({
          workout_id: row.workout_id,
          workout_def_id: row.workout_def_id,
          has_history: row.has_history,
          // T3-G: carry the cardio/recovery shape through. Dropping these
          // here would silently turn a newly-picked cardio session into a
          // row savePlan skips, and the user would watch it vanish on save.
          kind: row.kind,
          preset_activity_id: row.preset_activity_id ?? null,
          cardio_format: row.cardio_format ?? null,
          category_block_id: row.category_block_id ?? null,
          name: row.name,
        })),
        removed_workout_ids: day.removed,
      })),
    );
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDirty(false);
    router.push("/admin/programs");
  };

  return (
    <>
      <div>
        <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
          <button
            type="button"
            onClick={() => requestConfirmation(goBack)}
            className="text-[13px] font-medium text-subtle transition-colors hover:text-foreground"
          >
            Cancel
          </button>
          <h1 className="text-sm font-semibold text-foreground">Edit Plan</h1>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="font-mono text-[13px] font-bold uppercase tracking-[0.03em] text-accent transition-colors hover:text-accent/80 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        <div className="space-y-6 pt-[18px]">
          <div className="space-y-[7px]">
            <p className="eyebrow">Plan name</p>
            <div className="rounded-xl border border-border bg-input px-[14px] py-[13px] text-[15px] font-semibold text-foreground">
              {data.plan_name}
            </div>
            <p className="text-sm text-muted-foreground">
              Add a workout, cardio or recovery session to any day. Build them
              in Library → Workouts, Cardio and Recovery.
            </p>
          </div>

          <div className="space-y-2">
            <p className="eyebrow">Week schedule</p>
            <div className="space-y-[7px]">
              {days.map((day, dayIndex) => (
                <div
                  key={day.schedule_id}
                  className="space-y-3 rounded-xl border border-border bg-card p-[14px]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-[13px] font-semibold text-foreground">
                      {DAY_LABELS[day.day_of_week]}
                    </h2>
                    <div className="flex items-center gap-3">
                      {/* THE MISSING DOOR. This screen says "open a day to edit
                       * its sessions" and, until now, offered no way to do it —
                       * so the day editor, the only surface that can add a
                       * CARDIO or RECOVERY session, was reachable by typing a
                       * URL and nothing else. Marcus hit exactly that: "i can
                       * only add created workouts but no cardio or recovery
                       * sessions when I edit the plan." */}
                      <Link
                        href={`/admin/programs/${planId}/${day.day_of_week}`}
                        className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-accent underline underline-offset-2 transition-opacity hover:opacity-70"
                      >
                        Edit day
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                      <label className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">
                        Rest
                        <Checkbox
                          checked={day.is_rest_day}
                          onCheckedChange={(value) =>
                            toggleRest(dayIndex, Boolean(value))
                          }
                        />
                      </label>
                    </div>
                  </div>

                  {day.rows.length > 0 ? (
                    <ul className="space-y-[7px]">
                      {day.rows.map((row, rowIndex) => (
                        <li
                          key={`${row.workout_id ?? "new"}:${rowIndex}`}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card-alt px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-foreground">
                              {row.name}
                            </p>
                            {row.workout_def_id === null ? (
                              <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-faint">
                                Manual session — edit in the day editor
                              </p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-1">
                            <MoveButton
                              direction="up"
                              disabled={rowIndex === 0}
                              onClick={() => moveRow(dayIndex, rowIndex, -1)}
                            />
                            <MoveButton
                              direction="down"
                              disabled={rowIndex === day.rows.length - 1}
                              onClick={() => moveRow(dayIndex, rowIndex, 1)}
                            />
                            <button
                              type="button"
                              aria-label="Remove workout"
                              disabled={row.has_history}
                              onClick={() => removeRow(dayIndex, rowIndex)}
                              className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-danger transition-colors hover:bg-danger/10 disabled:pointer-events-none disabled:opacity-40"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : day.is_rest_day ? (
                    <div className="rounded-lg border border-dashed border-border px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
                      Rest day
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-[13px] text-faint">
                      No workouts on this day.
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => setPickerDay(dayIndex)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-[13px] font-semibold text-subtle transition-colors hover:border-faint hover:text-foreground"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add session
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          ) : null}

          <p className="text-center font-mono text-[11px] uppercase tracking-[0.04em] text-faint">
            Open a day to set timing, gym, or a session\u2019s blocks
          </p>
        </div>
      </div>

      <WorkoutPicker
        options={data.sessionOptions}
        open={pickerDay !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPickerDay(null);
          }
        }}
        onSelect={(option) => {
          if (pickerDay !== null) {
            addSession(pickerDay, option);
          }
          setPickerDay(null);
        }}
      />
      {discardDialog}
    </>
  );
}

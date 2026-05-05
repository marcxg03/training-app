import type {
  LoggerExercise,
  LoggerSetLog,
} from "@/lib/methodology/workout-state";
import { formatWeight } from "@/lib/units";
import { PRBadge } from "@/components/log/PRBadge";

type SetLogRowProps = {
  exercise: LoggerExercise;
  label: string;
  setLog: LoggerSetLog;
};

export function SetLogRow({ label, setLog }: SetLogRowProps) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/60 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {formatWeight(setLog.weight_kg ?? 0)} × {setLog.reps}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {setLog.is_to_failure ? (
            <span className="inline-flex min-h-6 items-center rounded-full border border-border px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Failure
            </span>
          ) : null}
          {setLog.prTypes.map((prType) => (
            <PRBadge key={prType} />
          ))}
        </div>
      </div>
      {setLog.notes ? (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {setLog.notes}
        </p>
      ) : null}
    </div>
  );
}

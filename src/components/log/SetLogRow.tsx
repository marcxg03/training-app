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
    <div className="rounded-xl border border-border bg-card px-3.5 py-3">
      <div className="flex items-center gap-3">
        <span className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-faint">
          {label}
        </span>
        <span className="font-mono text-[17px] font-semibold tabular-nums text-foreground">
          {formatWeight(setLog.weight_kg ?? 0)} × {setLog.reps}
        </span>
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          {setLog.prTypes.map((prType) => (
            <PRBadge key={prType} prType={prType} />
          ))}
          {setLog.is_to_failure ? (
            <span className="inline-flex min-h-6 items-center rounded-md border border-border px-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
              Failure
            </span>
          ) : null}
        </div>
      </div>
      {setLog.notes ? (
        <p className="mt-2 text-[13px] leading-5 text-muted-foreground">
          {setLog.notes}
        </p>
      ) : null}
    </div>
  );
}

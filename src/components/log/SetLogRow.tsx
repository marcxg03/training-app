import type { LoggerSetLog } from "@/lib/methodology/workout-state";
import { formatWeight } from "@/lib/units";

type SetLogRowProps = {
  label: string;
  setLog: LoggerSetLog;
};

// Styled to match the shared SetRow / demo LoggerSetRow so logged rows and
// target slots align in one stacked list: w-16 sans label, text-lg tabular-nums
// value, a green ✓ on done rows, the inline PR ▲ pill. Keeps the Failure badge
// and notes — real info the shared SetRow can't carry.
export function SetLogRow({ label, setLog }: SetLogRowProps) {
  const hasPr = setLog.prTypes.length > 0;

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="w-16 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-subtle">
          {label}
        </span>
        <span className="flex-1 text-lg font-semibold tabular-nums text-foreground">
          {formatWeight(setLog.weight_kg ?? 0)} × {setLog.reps}
        </span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {setLog.is_to_failure ? (
            <span className="inline-flex min-h-6 items-center rounded-md border border-border px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
              Failure
            </span>
          ) : null}
          {hasPr ? (
            setLog.prTypes.map((prType) => (
              <span
                key={prType}
                className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground"
              >
                PR ▲
              </span>
            ))
          ) : (
            <span className="text-success">✓</span>
          )}
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

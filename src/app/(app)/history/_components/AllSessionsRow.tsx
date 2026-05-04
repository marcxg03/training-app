import type { AllSessionsRow as AllSessionsRowData } from "@/lib/history/projections";
import { SessionLink } from "@/components/shared/SessionLink";
import { SessionStateBadge } from "@/app/(app)/history/_components/SessionStateBadge";

type AllSessionsRowProps = {
  row: AllSessionsRowData;
};

function formatSessionSummary(row: AllSessionsRowData): string {
  return `${row.blocks_completed_count} of ${row.blocks_total_count} blocks`;
}

export function AllSessionsRow({ row }: AllSessionsRowProps) {
  return (
    <li>
      <SessionLink
        completionId={row.completion_id}
        className="block rounded-xl border border-border/70 bg-background/60 px-4 py-4 transition-colors hover:border-accent/40"
      >
        <div className="flex min-h-11 items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p
              className={
                row.state === "in_progress"
                  ? "truncate text-base font-semibold text-foreground/70"
                  : "truncate text-base font-semibold text-foreground"
              }
            >
              {row.session_display_name}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <SessionStateBadge state={row.state} />
              <span className="text-sm text-muted-foreground">
                {formatSessionSummary(row)}
              </span>
              {row.pr_count > 0 ? (
                <span className="text-sm text-accent">
                  {row.pr_count} PR{row.pr_count === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </SessionLink>
    </li>
  );
}

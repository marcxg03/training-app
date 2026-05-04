import { EmptyState } from "@/app/(app)/library/_components/EmptyState";
import { LibraryTabs } from "@/app/(app)/library/_components/LibraryTabs";
import { RecoveryActivityCard } from "@/app/(app)/library/_components/RecoveryActivityCard";
import { getRecoveryBlock } from "@/lib/library/queries";

export default async function RecoveryLibraryPage() {
  const block = await getRecoveryBlock();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Library
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Recovery
        </h1>
      </div>

      <LibraryTabs />

      {!block ? (
        <EmptyState message="Recovery block not configured." />
      ) : (
        <section className="space-y-4">
          <div className="rounded-2xl border border-border/70 bg-card/80 px-4 py-4">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              {block.block_name}
            </h2>
          </div>
          {block.activities.length > 0 ? (
            <ul className="space-y-3">
              {block.activities.map((activity) => (
                <RecoveryActivityCard
                  key={activity.activity_id}
                  activity={activity}
                />
              ))}
            </ul>
          ) : (
            <EmptyState message="No recovery activities yet." />
          )}
        </section>
      )}
    </div>
  );
}

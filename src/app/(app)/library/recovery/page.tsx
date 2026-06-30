import { AddRecoveryActivityButton } from "@/app/(app)/library/_components/AddRecoveryActivityButton";
import { EmptyState } from "@/app/(app)/library/_components/EmptyState";
import { LibraryTabs } from "@/app/(app)/library/_components/LibraryTabs";
import { RecoveryActivityCard } from "@/app/(app)/library/_components/RecoveryActivityCard";
import { getRecoveryBlock } from "@/lib/library/queries";

export default async function RecoveryLibraryPage() {
  const block = await getRecoveryBlock();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="space-y-1">
        <p className="eyebrow">Library</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Recovery
        </h1>
      </div>

      <LibraryTabs />

      {!block ? (
        <EmptyState message="Recovery block not configured." />
      ) : (
        <section className="space-y-4">
          {block.activities.length > 0 ? (
            <div className="space-y-4">
              <ul className="space-y-2.5">
                {block.activities.map((activity) => (
                  <RecoveryActivityCard
                    key={activity.activity_id}
                    activity={activity}
                  />
                ))}
              </ul>
              <AddRecoveryActivityButton blockId={block.block_id} />
            </div>
          ) : (
            <div className="space-y-4">
              <EmptyState message="No recovery activities yet." />
              <AddRecoveryActivityButton blockId={block.block_id} />
            </div>
          )}
        </section>
      )}
    </div>
  );
}

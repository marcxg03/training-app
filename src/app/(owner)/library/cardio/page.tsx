import { AddCardioActivityButton } from "@/app/(owner)/library/_components/AddCardioActivityButton";
import { CardioActivityCard } from "@/app/(owner)/library/_components/CardioActivityCard";
import { EmptyState } from "@/app/(owner)/library/_components/EmptyState";
import { LibraryTabs } from "@/app/(owner)/library/_components/LibraryTabs";
import { getCardioBlock } from "@/lib/library/queries";

export default async function CardioLibraryPage() {
  const block = await getCardioBlock();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="space-y-1">
        <p className="eyebrow">Library</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Cardio
        </h1>
      </div>

      <LibraryTabs />

      {!block ? (
        <EmptyState message="Cardio block not configured." />
      ) : (
        <section className="space-y-4">
          {block.activities.length > 0 ? (
            <div className="space-y-4">
              <ul className="space-y-2.5">
                {block.activities.map((activity) => (
                  <CardioActivityCard
                    key={activity.activity_id}
                    activity={activity}
                  />
                ))}
              </ul>
              <AddCardioActivityButton blockId={block.block_id} />
            </div>
          ) : (
            <div className="space-y-4">
              <EmptyState message="No cardio activities yet." />
              <AddCardioActivityButton blockId={block.block_id} />
            </div>
          )}
        </section>
      )}
    </div>
  );
}

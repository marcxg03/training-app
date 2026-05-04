import { BlockListCard } from "@/app/(app)/library/_components/BlockListCard";
import { EmptyState } from "@/app/(app)/library/_components/EmptyState";
import { LibraryTabs } from "@/app/(app)/library/_components/LibraryTabs";
import { getLiftingBlocks } from "@/lib/library/queries";

export default async function LiftingLibraryPage() {
  const blocks = await getLiftingBlocks();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Library
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Lifting
        </h1>
      </div>

      <LibraryTabs />

      {blocks.length > 0 ? (
        <ul className="space-y-3">
          {blocks.map((block) => (
            <BlockListCard key={block.block_id} block={block} />
          ))}
        </ul>
      ) : (
        <EmptyState message="No lifting blocks yet." />
      )}
    </div>
  );
}

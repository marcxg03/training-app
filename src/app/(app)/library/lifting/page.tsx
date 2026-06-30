import { AddBlockButton } from "@/app/(app)/library/_components/AddBlockButton";
import { BlockListCard } from "@/app/(app)/library/_components/BlockListCard";
import { EmptyState } from "@/app/(app)/library/_components/EmptyState";
import { LibraryTabs } from "@/app/(app)/library/_components/LibraryTabs";
import { getLiftingBlocks } from "@/lib/library/queries";

export default async function LiftingLibraryPage() {
  const blocks = await getLiftingBlocks();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="space-y-1">
        <p className="eyebrow">Library</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Lifting
        </h1>
      </div>

      <LibraryTabs />

      {blocks.length > 0 ? (
        <div className="space-y-4">
          <ul className="space-y-2.5">
            {blocks.map((block) => (
              <BlockListCard key={block.block_id} block={block} />
            ))}
          </ul>
          <AddBlockButton />
        </div>
      ) : (
        <div className="space-y-4">
          <EmptyState message="No lifting blocks yet." />
          <AddBlockButton />
        </div>
      )}
    </div>
  );
}

import { redirect } from "next/navigation";

import { BlockDetailHeader } from "@/app/(app)/library/_components/BlockDetailHeader";
import { DeleteLibraryItemButton } from "@/app/(app)/library/_components/DeleteLibraryItemButton";
import { EditBlockButton } from "@/app/(app)/library/_components/EditBlockButton";
import { ExerciseListItem } from "@/app/(app)/library/_components/ExerciseListItem";
import { getBlockDetail } from "@/lib/library/queries";
import { liftingHref } from "@/lib/library/crossLinks";

type BlockDetailPageProps = {
  params: Promise<{
    block_id: string;
  }>;
};

export default async function BlockDetailPage({
  params,
}: BlockDetailPageProps) {
  const { block_id: blockId } = await params;
  const block = await getBlockDetail(blockId);

  if (!block) {
    redirect(liftingHref());
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <BlockDetailHeader block={block} />
        <div className="pt-12">
          <EditBlockButton blockId={blockId} />
        </div>
      </div>
      <ul className="space-y-2.5">
        {block.exercises.map((exercise) => (
          <ExerciseListItem
            key={`${exercise.exercise_id}:${exercise.display_order}`}
            exercise={exercise}
          />
        ))}
      </ul>
      <DeleteLibraryItemButton
        kind="block"
        id={blockId}
        name={block.block_name}
        redirectTo={liftingHref()}
        variant="bar"
      />
    </div>
  );
}

import { redirect } from "next/navigation";

import { BlockDetailHeader } from "@/app/(app)/library/_components/BlockDetailHeader";
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
    <div className="mx-auto max-w-4xl space-y-6">
      <BlockDetailHeader block={block} />
      <ul className="space-y-3">
        {block.exercises.map((exercise) => (
          <ExerciseListItem
            key={`${exercise.exercise_id}:${exercise.display_order}`}
            exercise={exercise}
          />
        ))}
      </ul>
    </div>
  );
}

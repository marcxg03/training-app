import { redirect } from "next/navigation";

import { BlockForm } from "@/app/(app)/library/_components/BlockForm";
import {
  getExercises,
  getBlockDetail,
  getHistoricalSetLogCount,
} from "@/lib/library/queries";
import { liftingHref } from "@/lib/library/crossLinks";

type EditBlockPageProps = {
  params: Promise<{
    block_id: string;
  }>;
};

export default async function EditBlockPage({ params }: EditBlockPageProps) {
  const { block_id: blockId } = await params;
  const [block, exercises, historicalSetLogCount] = await Promise.all([
    getBlockDetail(blockId),
    getExercises(),
    getHistoricalSetLogCount(blockId),
  ]);

  if (!block) {
    redirect(liftingHref());
  }

  return (
    <div className="mx-auto max-w-4xl">
      <BlockForm
        mode="edit"
        blockId={blockId}
        exercises={exercises}
        historicalSetLogCount={historicalSetLogCount}
        initialValues={{
          block_name: block.block_name,
          block_category: "lifting",
          block_type: block.block_type,
          warmup_sets: block.warmup_sets,
          working_sets: block.working_sets,
          to_failure: block.to_failure,
          bank: block.exercises.map((exercise) => ({
            exercise_id: exercise.exercise_id,
            display_order: exercise.display_order,
          })),
        }}
      />
    </div>
  );
}

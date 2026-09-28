import { redirect } from "next/navigation";

import { WorkoutDefForm } from "@/app/(owner)/library/_components/WorkoutDefForm";
import { workoutsHref } from "@/lib/library/crossLinks";
import { getLiftingBlocks, getWorkoutDefDetail } from "@/lib/library/queries";

type EditWorkoutPageProps = {
  params: Promise<{
    workout_def_id: string;
  }>;
};

export default async function EditWorkoutPage({
  params,
}: EditWorkoutPageProps) {
  const { workout_def_id: workoutDefId } = await params;
  const [workout, blocks] = await Promise.all([
    getWorkoutDefDetail(workoutDefId),
    getLiftingBlocks(),
  ]);

  if (!workout) {
    redirect(workoutsHref());
  }

  return (
    <div className="mx-auto max-w-4xl">
      <WorkoutDefForm
        mode="edit"
        workoutDefId={workoutDefId}
        blocks={blocks}
        initialValues={{
          name: workout.name,
          blocks: workout.blocks.map((block) => ({
            block_id: block.block_id,
            display_order: block.display_order,
          })),
        }}
      />
    </div>
  );
}

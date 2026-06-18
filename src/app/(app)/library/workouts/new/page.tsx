import { WorkoutDefForm } from "@/app/(app)/library/_components/WorkoutDefForm";
import { getLiftingBlocks } from "@/lib/library/queries";

export default async function NewWorkoutPage() {
  const blocks = await getLiftingBlocks();

  return (
    <div className="mx-auto max-w-4xl">
      <WorkoutDefForm mode="create" blocks={blocks} />
    </div>
  );
}

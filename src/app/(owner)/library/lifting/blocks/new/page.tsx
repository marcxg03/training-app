import { BlockForm } from "@/app/(owner)/library/_components/BlockForm";
import { getExercises } from "@/lib/library/queries";

export default async function NewBlockPage() {
  const exercises = await getExercises();

  return (
    <div className="mx-auto max-w-4xl">
      <BlockForm mode="create" exercises={exercises} />
    </div>
  );
}

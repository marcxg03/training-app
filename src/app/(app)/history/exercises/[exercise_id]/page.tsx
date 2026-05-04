import type { JSX } from "react";

type ExerciseProgressPlaceholderPageProps = {
  params: Promise<{
    exercise_id: string;
  }>;
};

export default async function ExerciseProgressPlaceholderPage({
  params,
}: ExerciseProgressPlaceholderPageProps): Promise<JSX.Element> {
  await params;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="rounded-xl border border-dashed border-border/80 bg-card/80 px-6 py-10 text-center">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          History
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
          Coming soon
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Coming soon — Slice 6.2
        </p>
      </div>
    </div>
  );
}

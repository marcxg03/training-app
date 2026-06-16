import type { DayTypeFramework } from "@/lib/methodology/nutrition";

const EMPHASIS_LABEL = {
  protein: "Protein",
  carbs: "Carbs",
  fat: "Fat",
} as const;

export function DayTypeFrameworkCard({
  framework,
}: {
  framework: DayTypeFramework;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          {framework.title}
        </h2>
        <span className="rounded-full border border-accent/40 px-3 py-1 text-xs font-medium uppercase tracking-wide text-accent">
          Emphasis: {EMPHASIS_LABEL[framework.emphasis]}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{framework.guidance}</p>
    </section>
  );
}

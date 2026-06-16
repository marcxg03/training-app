import type { MealEntry } from "@/lib/nutrition/projections";

export function MealList({ meals }: { meals: MealEntry[] }) {
  if (meals.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No meals logged yet today. Tap “Log meal” to start.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {meals.map((meal) => (
        <li
          key={meal.meal_id}
          className="rounded-2xl border border-border bg-card p-4"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-medium text-foreground">
              {meal.meal_type}
            </span>
            <span className="text-sm tabular-nums text-muted-foreground">
              {meal.calories} kcal
            </span>
          </div>
          <div className="mt-1 text-sm tabular-nums text-muted-foreground">
            P {meal.protein_g}g · C {meal.carbs_g}g · F {meal.fat_g}g
          </div>
          {meal.note ? (
            <p className="mt-1.5 text-sm text-muted-foreground">{meal.note}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

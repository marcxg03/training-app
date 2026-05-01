import type { Enums } from "@/lib/supabase/types";

type TodayHeaderProps = {
  dayOfWeek: Enums<"day_of_week_enum">;
  date: Date;
};

const dayLabels: Record<Enums<"day_of_week_enum">, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function TodayHeader({ dayOfWeek, date }: TodayHeaderProps) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
        Today
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
        {dayLabels[dayOfWeek]}
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {formatDate(date)}
      </p>
    </div>
  );
}

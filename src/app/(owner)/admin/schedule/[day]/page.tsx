import { notFound, redirect } from "next/navigation";

import { DayEditForm } from "./_components/DayEditForm";
import { requireOwner } from "@/lib/auth/requireOwner";
import { getDayEditData } from "@/lib/plan/queries";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/types";

const DAY_LABELS: Record<Enums<"day_of_week_enum">, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

type EditPlanDayPageProps = {
  params: Promise<{ day: string }>;
};

export default async function EditPlanDayPage({
  params,
}: EditPlanDayPageProps) {
  // Day editing is owner-only authoring (Slice S0 · D18/D22).
  await requireOwner();

  const { day } = await params;

  if (!(day in DAY_LABELS)) {
    notFound();
  }
  const parsedDay = day as Enums<"day_of_week_enum">;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const data = await getDayEditData(parsedDay);
  if (!data) {
    notFound();
  }

  return (
    <DayEditForm day={parsedDay} dayLabel={DAY_LABELS[parsedDay]} data={data} />
  );
}

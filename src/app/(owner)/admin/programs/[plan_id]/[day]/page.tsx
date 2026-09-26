import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

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

/**
 * /admin/programs/<plan_id>/<day> — one day of one program (T3-C · D48).
 *
 * The day editor used to resolve its plan by asking "which one is active",
 * which meant a non-active program's days simply could not be edited. It takes
 * the plan from the URL now, which is what makes Programs the single authoring
 * surface and let Schedule be removed.
 *
 * Ownership is verified on the plan ROW before any day data is read — the
 * route guard proves the caller is an owner, this proves the program is theirs.
 */
export default async function ProgramDayPage({
  params,
}: {
  params: Promise<{ plan_id: string; day: string }>;
}) {
  const ownerId = await requireOwner();
  const { plan_id: planId, day } = await params;

  if (!(day in DAY_LABELS)) {
    notFound();
  }
  const parsedDay = day as Enums<"day_of_week_enum">;

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("training_plans")
    .select("plan_id, name")
    .eq("plan_id", planId)
    .eq("user_id", ownerId)
    .maybeSingle();

  if (!plan) {
    notFound();
  }

  const data = await getDayEditData(parsedDay, planId);

  if (!data) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-1.5">
        <Link
          href={`/admin/programs/${planId}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-subtle transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {plan.name}
        </Link>
      </header>

      <DayEditForm
        day={parsedDay}
        dayLabel={DAY_LABELS[parsedDay]}
        data={data}
        backHref={`/admin/programs/${planId}`}
      />
    </div>
  );
}

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { requireOwner } from "@/lib/auth/requireOwner";
import { getProgramList } from "@/lib/plan/queries";
import {
  CreateProgramButton,
  ProgramActions,
} from "./_components/ProgramActions";

/**
 * /admin/programs — the program list (T3-C · D48).
 *
 * T3-A shipped this READ-ONLY against `plan_templates`, which turned out to be
 * the wrong table: `plan_templates` is written only by the seed script and is
 * an immutable snapshot archive. The real programs — the ones the app trains
 * against, and the ones `plan-mutations.ts` has always had create / rename /
 * activate / delete for — live in `training_plans`.
 *
 * Marcus spotted the symptom from the other side: "why is the schedule tab
 * editable - shouldn't editing only happen in the program editing page?" It
 * was editable because the week editor was hardcoded to the ACTIVE plan, which
 * is the only reason Schedule existed as its own section. Opening a program
 * here now IS the program editor, and Schedule is gone.
 *
 * EXACTLY ONE PROGRAM IS ACTIVE. That is enforced by `activatePlan` (it
 * deactivates the others in the same call) and relied on everywhere the app
 * asks "what am I training today", so the active badge is a statement about
 * the whole list, not a per-row toggle.
 */

export default async function AdminProgramsPage() {
  const ownerId = await requireOwner();
  const programs = await getProgramList(ownerId);

  const dateFormat = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <p className="eyebrow">Owner · Admin</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Programs
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            Every program you have written. Open one to edit its week. Exactly
            one program is active at a time — that is the one the app trains you
            against.
          </p>
        </div>
        <CreateProgramButton userId={ownerId} />
      </header>

      {programs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card-alt p-5 text-sm text-subtle">
          No programs yet. Create one to get started.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {programs.map((program) => (
            <li
              key={program.plan_id}
              className={`rounded-xl border bg-card p-4 ${
                program.is_active ? "border-accent/50" : "border-border"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Link
                  href={`/admin/programs/${program.plan_id}`}
                  className="group min-w-0 flex-1"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold text-foreground group-hover:underline">
                      {program.name}
                    </span>
                    {program.is_active ? (
                      <span className="rounded-full border border-accent/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                        Active
                      </span>
                    ) : null}
                    <ChevronRight className="h-4 w-4 text-faint transition-transform group-hover:translate-x-0.5" />
                  </span>
                  <span className="mt-0.5 block text-xs text-subtle">
                    {program.training_days} training{" "}
                    {program.training_days === 1 ? "day" : "days"} ·{" "}
                    {program.sessions}{" "}
                    {program.sessions === 1 ? "session" : "sessions"} · created{" "}
                    {dateFormat.format(new Date(program.created_at))}
                  </span>
                </Link>
              </div>

              <div className="mt-3 border-t border-border pt-3">
                <ProgramActions
                  userId={ownerId}
                  program={program}
                  totalPrograms={programs.length}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

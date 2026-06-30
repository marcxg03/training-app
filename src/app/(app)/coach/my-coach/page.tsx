import { ClipboardList, Eye, UserX, UtensilsCrossed } from "lucide-react";

import { ClientAvatar } from "@/components/coach/ClientAvatar";
import { MyCoachMessage } from "@/components/coach/MyCoachMessage";
import { getMyCoach, linkPendingInvites } from "@/lib/coach/queries";

/**
 * Client · My Coach (Frame 48) — the coached client's view of the relationship:
 * who's-my-coach, assigned plan/targets, client-visible coach notes, and a
 * message composer (REDESIGN_BRIEF §8.2).
 */
export default async function MyCoachPage() {
  // Attach any invite addressed to this user's email before reading.
  await linkPendingInvites();
  const coach = await getMyCoach();

  if (!coach) {
    return (
      <div className="space-y-6">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
            Your coach
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
            My Coach
          </h1>
        </div>
        <div className="flex flex-col items-center justify-center rounded-[var(--radius)] border border-dashed border-border px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-[16px] border border-border bg-card-alt">
            <UserX className="h-7 w-7 text-faint" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-foreground">
            No coach yet
          </h2>
          <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-subtle">
            When a coach invites you by email, accept and they&apos;ll appear
            here with your assigned plan and targets.
          </p>
        </div>
      </div>
    );
  }

  const coachNotes = coach.notes.filter((note) => !note.fromClient);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
          Your coach
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
          My Coach
        </h1>
      </div>

      <div className="flex items-center gap-3.5 rounded-[var(--radius)] border border-border bg-card p-4">
        <ClientAvatar initials={coach.coachInitials} size="lg" />
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-foreground">
            {coach.coachName}
          </h2>
          <p className="eyebrow mt-0.5 tracking-[0.08em] text-faint">
            {coach.sinceLabel}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="eyebrow tracking-[0.16em] text-subtle">Assigned to you</p>
        <div className="space-y-2">
          <div className="flex items-center gap-3.5 rounded-[13px] border border-border bg-card p-3.5">
            <ClipboardList className="h-5 w-5 flex-none text-accent" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                Training plan
              </p>
              <p className="eyebrow mt-0.5 tracking-[0.06em] text-faint">
                {coach.assignedPlanName.toUpperCase()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3.5 rounded-[13px] border border-border bg-card p-3.5">
            <UtensilsCrossed className="h-5 w-5 flex-none text-accent" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                Nutrition targets
              </p>
              <p className="eyebrow mt-0.5 tracking-[0.06em] text-faint">
                {coach.targetsSummary.toUpperCase()}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5 text-faint" />
          <p className="eyebrow tracking-[0.16em] text-subtle">
            Notes from your coach
          </p>
        </div>
        <div className="space-y-2">
          {coachNotes.map((note) => (
            <div
              key={note.id}
              className="rounded-[14px] border border-l-[3px] border-border border-l-accent bg-card px-3.5 py-3.5"
            >
              <p className="text-sm leading-relaxed text-foreground">
                {note.body}
              </p>
              <p className="mt-2.5 font-mono text-[9px] uppercase tracking-[0.08em] text-faint">
                {note.createdAtLabel}
              </p>
            </div>
          ))}
        </div>
      </div>

      <MyCoachMessage />

      <p className="text-center font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
        You own your data · your coach can view &amp; assign
      </p>
    </div>
  );
}

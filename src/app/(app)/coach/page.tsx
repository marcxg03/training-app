import Link from "next/link";
import { UserPlus } from "lucide-react";

import { CoachTabBar } from "@/components/coach/CoachTabBar";
import { PersonaSwitcher } from "@/components/coach/PersonaSwitcher";
import { RosterCard } from "@/components/coach/RosterCard";
import { RosterEmptyState } from "@/components/coach/RosterEmptyState";
import { getRoster } from "@/lib/coach/queries";

type CoachRosterPageProps = {
  searchParams: Promise<{ empty?: string }>;
};

export default async function CoachRosterPage({
  searchParams,
}: CoachRosterPageProps) {
  // `?empty=1` renders the first-run empty state (Frame 39) on demand.
  const params = await searchParams;
  const roster = params.empty === "1" ? [] : await getRoster();

  const needsAttention = roster.filter(
    (client) => client.needsAttention,
  ).length;
  const pending = roster.filter((client) => client.status === "invited").length;
  const summaryParts = [
    needsAttention > 0 ? `${needsAttention} needs attention` : null,
    pending > 0 ? `${pending} pending` : null,
  ].filter((part): part is string => part !== null);

  return (
    <div className="-mx-6 -my-8 flex min-h-[calc(100vh-0px)] flex-col">
      <div className="px-6 pt-2">
        <PersonaSwitcher active="coaching" />
      </div>

      {roster.length === 0 ? (
        <div className="flex flex-1 flex-col px-6 pb-6 pt-6">
          <RosterEmptyState />
        </div>
      ) : (
        <>
          <div className="px-6 pb-3 pt-4">
            <h1 className="text-[28px] font-semibold tracking-tight text-foreground">
              {roster.length} clients
            </h1>
            {summaryParts.length > 0 ? (
              <p className="eyebrow mt-1 tracking-[0.08em] text-faint">
                {summaryParts.join(" · ")}
              </p>
            ) : null}
          </div>

          <div className="flex-1 space-y-2.5 px-6 pb-4">
            {roster.map((client) => (
              <RosterCard key={client.id} client={client} />
            ))}
          </div>

          <div className="border-t border-border bg-card-alt px-6 py-3">
            <Link
              href="/coach/onboard"
              className="flex items-center justify-center gap-2 rounded-[13px] bg-accent px-4 py-3.5 font-mono text-[13px] font-bold uppercase tracking-[0.08em] text-black transition-colors hover:bg-accent/90"
            >
              <UserPlus className="h-5 w-5" />
              Onboard a client
            </Link>
          </div>
        </>
      )}

      <CoachTabBar />
    </div>
  );
}

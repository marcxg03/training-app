import { CircleDot, Globe, Lock } from "lucide-react";

import { requireOwner } from "@/lib/auth/requireOwner";
import { createClient } from "@/lib/supabase/server";
import { summarizeProgramSnapshot } from "@/lib/admin/program-summary";

/**
 * /admin/programs — the program list (T3-A, read-only).
 *
 * WHAT IS REAL HERE: every row is a `plan_templates` snapshot the seed has
 * actually written, summarised through the defensive reader in
 * src/lib/admin/program-summary.ts (the rows are NOT uniformly shaped — see
 * that module).
 *
 * WHAT IS NOT HERE YET, and why the page says so out loud: create, rename,
 * publish, archive. `plan_templates` has `is_public boolean` and nothing else
 * — no title column, and no state for "archived" as distinct from "private".
 * A boolean cannot express draft / published / archived, so T3-B adds the
 * migration and the mutations. Shipping the buttons against a column that
 * cannot hold the state would be the worse half of the feature.
 *
 * A wide table on purpose: this is the desktop hub (D18), and the member app
 * is where the phone-shaped surfaces live. It still degrades to stacked cards
 * under `md:` rather than scrolling sideways.
 */

export default async function AdminProgramsPage() {
  const ownerId = await requireOwner();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("plan_templates")
    .select("template_id, version, is_public, created_at, snapshot_json")
    .eq("owner_user_id", ownerId)
    .order("version", { ascending: false });

  const rows = (data ?? []).map((row) => ({
    ...row,
    summary: summarizeProgramSnapshot(row.snapshot_json, `Version ${row.version}`), // prettier-ignore
  }));

  const dateFormat = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-8">
      <header className="space-y-1.5">
        <p className="eyebrow">Owner · Admin</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Programs
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          Every saved snapshot of your plan, newest first. Each one is a
          complete record of what the plan looked like when it was written.
        </p>
      </header>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger"
        >
          Could not load programs: {error.message}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card-alt p-5 text-sm text-subtle">
          No program snapshots yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {/* Header row: only earns its space once the columns line up. */}
          <div className="hidden border-b border-border px-4 py-2.5 md:grid md:grid-cols-[1fr_auto_auto_auto] md:gap-4">
            <span className="eyebrow">Program</span>
            <span className="eyebrow text-right">Days</span>
            <span className="eyebrow text-right">Saved</span>
            <span className="eyebrow text-right">Visibility</span>
          </div>

          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li
                key={row.template_id}
                className="flex flex-col gap-2 px-4 py-3 md:grid md:grid-cols-[1fr_auto_auto_auto] md:items-center md:gap-4"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {row.summary.name}
                  </span>
                  <span className="block text-xs text-faint">
                    Version {row.version}
                    {row.summary.hasBlocks ? "" : " · pre-blocks snapshot"}
                  </span>
                </span>

                <span className="text-xs tabular-nums text-subtle md:text-right md:text-sm">
                  {row.summary.dayCount === null ? (
                    <span className="text-faint">—</span>
                  ) : (
                    <>
                      {row.summary.dayCount}
                      {row.summary.restDayCount !== null &&
                      row.summary.restDayCount > 0 ? (
                        <span className="text-faint">
                          {" "}
                          ({row.summary.restDayCount} rest)
                        </span>
                      ) : null}
                    </>
                  )}
                </span>

                <span className="text-xs tabular-nums text-subtle md:text-right md:text-sm">
                  {dateFormat.format(new Date(row.created_at))}
                </span>

                <span className="md:text-right">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      row.is_public
                        ? "border-success/40 text-success"
                        : "border-border text-faint"
                    }`}
                  >
                    {row.is_public ? (
                      <Globe className="h-3 w-3" />
                    ) : (
                      <Lock className="h-3 w-3" />
                    )}
                    {row.is_public ? "Public" : "Private"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex max-w-xl flex-col gap-2 rounded-xl border border-dashed border-border bg-card-alt p-5">
        <span className="flex items-center gap-2 text-faint">
          <CircleDot className="h-4 w-4" />
          <span className="eyebrow">Read-only for now</span>
        </span>
        <p className="text-sm leading-relaxed text-subtle">
          Create, rename, publish and archive are not wired up.{" "}
          <code className="rounded bg-input px-1 py-0.5 text-[12px]">
            plan_templates
          </code>{" "}
          carries a single <code className="text-[12px]">is_public</code>{" "}
          boolean, which cannot express draft vs published vs archived — so the
          state has to exist in the schema before the buttons can be honest.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Next:</span> T3-B adds
          the migration and the mutations.
        </p>
      </div>
    </div>
  );
}

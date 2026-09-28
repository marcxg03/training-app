import type { JSX } from "react";
import { Construction } from "lucide-react";

/**
 * The honest placeholder (T3-A).
 *
 * A sidebar section that routes somewhere must SAY it is unbuilt, and say why
 * and what unblocks it. The alternative — the S6 stub's four "Soon" cards with
 * confident feature copy — reads as shipped software and is how a hub starts
 * lying about its own state.
 *
 * Delete the call site in the slice that builds the section, and clear the
 * matching `soon` flag in src/lib/nav/admin.ts (scripts/verify-admin-nav.ts
 * asserts the flag is absent for the sections that ARE built).
 */
export function NotBuiltYet({
  title,
  because,
  unblockedBy,
}: {
  title: string;
  /** Why it is not built — the real reason, not "coming soon". */
  because: string;
  /** What has to happen first. */
  unblockedBy: string;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-8">
      <header className="space-y-1.5">
        <p className="eyebrow">Owner · Admin</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
      </header>

      <div className="flex max-w-xl flex-col gap-3 rounded-xl border border-dashed border-border bg-card-alt p-5">
        <span className="flex items-center gap-2 text-faint">
          <Construction className="h-4 w-4" />
          <span className="eyebrow">Not built yet</span>
        </span>
        <p className="text-sm leading-relaxed text-subtle">{because}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Unblocked by:</span>{" "}
          {unblockedBy}
        </p>
      </div>
    </div>
  );
}

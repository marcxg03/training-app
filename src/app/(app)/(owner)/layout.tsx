import type { ReactNode } from "react";

import { requireOwner } from "@/lib/auth/requireOwner";

/**
 * Owner-only route group (Slice S6 · D25).
 *
 * A structural guard: every route placed under `src/app/(app)/(owner)/**` is
 * gated by this one `requireOwner()` call, so owner-only surfaces can no longer
 * depend on per-page discipline (Roast S0 Security F3). `requireOwner()` throws
 * `notFound()` for any non-owner (including unauthenticated requests the outer
 * `(app)` layout hasn't already bounced), so the route 404s rather than
 * advertising its existence.
 *
 * The route group `(owner)` does NOT change URLs — `/admin` still lives at
 * `/admin`.
 *
 * SCOPE (this build): only the `/admin` stub lives here. Per the S6 brief the
 * existing plan-authoring routes (`/plan/edit`, `/plan/[day]/edit`) are NOT
 * moved under this group — their URLs are linked from the day cards, and they
 * keep their per-page `requireOwner()` guards. D25's full consolidation (moving
 * those routes in too) is deferred to the desktop admin-hub build.
 */
export default async function OwnerLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireOwner();
  return <>{children}</>;
}

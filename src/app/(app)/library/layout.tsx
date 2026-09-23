import type { ReactNode } from "react";

import { requireOwner } from "@/lib/auth/requireOwner";

/**
 * Owner-gate for the entire Library route group (Slice S0 · D18/D22).
 *
 * The Library is the exercise/block/workout AUTHORING surface — desktop-only,
 * owner-only. This layout wraps every `/library/**` page, so a non-owner
 * hitting any of them gets `notFound()` before the page renders. Library was
 * also removed from the mobile bottom nav (D19); this closes the direct-URL
 * door too.
 */
export default async function LibraryLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireOwner();
  return <>{children}</>;
}

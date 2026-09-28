import type { ReactNode } from "react";

import { requireOwner } from "@/lib/auth/requireOwner";

/**
 * Owner-gate for the Library authoring surface (S0 · D18/D22, moved T3-B).
 *
 * MOVED IN T3-B from `(app)/library` to `(owner)/library`. It used to live in
 * the MEMBER route group, which meant the authoring surface rendered inside
 * the phone shell — bottom tab bar, phone padding, and no route back to the
 * hub. Marcus hit exactly that: "when I click into libraries I cant return to
 * library desktop … it goes into plan tab of mobile view". Under `(owner)` it
 * inherits the hub's sidebar instead, so the builder is self-contained.
 *
 * URLs are unchanged — a route group never appears in the path — so every
 * existing `/library/**` link still resolves.
 *
 * This guard is now REDUNDANT with the `(owner)` group's own layout, and that
 * is deliberate. It costs one cached `getUser()` call and it means the Library
 * stays gated on its own merits if it is ever moved again — which is precisely
 * the failure this slice just demonstrated is possible.
 */
export default async function LibraryLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireOwner();
  return <>{children}</>;
}

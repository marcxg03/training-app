import { notFound } from "next/navigation";

import { isOwner } from "@/lib/auth/owner";
import { createClient } from "@/lib/supabase/server";

/**
 * Server guard for owner-only authoring routes (Slice S0 · D18/D22).
 *
 * Call at the top of a server component / route (or from a route-group
 * layout.tsx) that must be reachable ONLY by the app owner — the Library
 * builder (`/library/**`), plan/day editing (`/plan/edit`,
 * `/plan/[day]/edit`), and the future `/admin` hub. A non-owner (including an
 * unauthenticated request) gets `notFound()` — we hide the surface's existence
 * rather than advertise it with a redirect. The `(app)` layout already bounces
 * truly-unauthenticated users to `/login`; this narrows the authenticated set
 * to owners.
 *
 * Returns the owner's user id on success (never returns for a non-owner —
 * `notFound()` throws).
 */
export async function requireOwner(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isOwner(user?.id)) {
    notFound();
  }

  return user!.id;
}

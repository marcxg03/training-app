import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { requireOwner } from "@/lib/auth/requireOwner";
import { createClient } from "@/lib/supabase/server";

/**
 * Owner-only route group — the admin hub's own shell (T3-A · D18/D25).
 *
 * MOVED OUT OF `(app)` IN T3-A. It used to be `(app)/(owner)/`, which meant it
 * inherited the MEMBER app's chrome: a bottom tab bar it must not have, and
 * phone padding that wastes two thirds of a desktop screen. The hub is a
 * different product for a different device (D18: authoring is desktop-only),
 * so it gets its own layout. URLs are unchanged — a route group never appears
 * in the path, so `/admin` is still `/admin`.
 *
 * Consequence of the move: this layout must now do the auth work `(app)` used
 * to do for it. Order matters and is deliberate:
 *   1. unauthenticated            → redirect to /login (same as the member app)
 *   2. authenticated, not owner   → notFound() inside requireOwner()
 * A non-owner gets a 404 rather than a redirect, so the hub's existence is
 * never advertised (Roast S0 Security F3).
 *
 * This is the STRUCTURAL guard D25 asked for: every route under
 * `src/app/(owner)/**` is gated by this one call, so owner-only coverage no
 * longer depends on remembering to guard each page. The library and
 * plan-authoring routes still live under `(app)` with their own per-page
 * guards; folding them in here is T3-B's job, not this slice's.
 */
export default async function OwnerLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await requireOwner();

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      <AdminSidebar />
      <main className="min-w-0 flex-1 px-5 py-6 lg:px-10 lg:py-10">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

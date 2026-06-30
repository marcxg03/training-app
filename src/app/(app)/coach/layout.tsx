import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { COACHING_ENABLED } from "@/lib/coach/flag";

/**
 * Gate the entire `/coach/**` tree behind the coaching feature flag. Coaching
 * is UI-only on mock data (no backend), so when the flag is off — the default,
 * and required for any real-user deployment — every coach route redirects to
 * the athlete home so the mock surfaces are never reachable in production.
 */
export default function CoachLayout({ children }: { children: ReactNode }) {
  if (!COACHING_ENABLED) {
    redirect("/today");
  }

  return <>{children}</>;
}

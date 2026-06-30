/**
 * Coaching feature flag.
 *
 * The coaching surfaces (roster, client detail, assign, notes, etc.) are
 * UI-only and run on MOCK data — there is no backend yet. They must NOT be
 * reachable by real users until the Supabase-backed coaching slice lands.
 *
 * Off by default. Set `NEXT_PUBLIC_COACHING_ENABLED=true` to preview the
 * coaching UI in dev. When false:
 *   - the persona switcher hides the "Coaching" entry (renders a static pill)
 *   - the `/coach/**` route group redirects to `/today`
 *
 * `NEXT_PUBLIC_*` is inlined at build time, so this is readable from both
 * server and client components.
 */
export const COACHING_ENABLED =
  process.env.NEXT_PUBLIC_COACHING_ENABLED === "true";

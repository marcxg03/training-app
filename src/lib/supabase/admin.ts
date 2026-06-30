import { createClient } from "@supabase/supabase-js";

import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/types";

/**
 * Service-role Supabase client. Bypasses Row Level Security, so it is
 * SERVER-ONLY and must never be imported into a client component or exposed to
 * the browser. The service-role key is read from a non-`NEXT_PUBLIC_` env var,
 * so importing this from client code would fail the build.
 *
 * In the coaching surface this is used exclusively to read a client's own data
 * (logs, PRs, schedule) for coach analytics, and only AFTER the coach↔client
 * relationship has been verified with the session client. See
 * src/lib/coach/queries.ts (`assertCoachClient`).
 */
export function createAdminClient() {
  return createClient<Database>(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

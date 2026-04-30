import { createClient } from "@supabase/supabase-js";

import type { Database } from "../../../src/lib/supabase/types";
import {
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "../../../src/lib/supabase/env";

export function createSupabaseAdminClient() {
  return createClient<Database>(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

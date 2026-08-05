import { cache } from "react";

import {
  dateStringInTz,
  dayOfWeekInTz,
  DEFAULT_APP_TIMEZONE,
  isValidTimezone,
} from "@/lib/time/appDay";
import { createClient } from "@/lib/supabase/server";

// Per-request app timezone, read from the profile. React cache() dedupes the
// profile read across every call in one render pass. Falls back to the
// default when the column doesn't exist yet (migration 022 not applied) or
// the stored value is invalid — a broken clock must never crash a page.
export const getAppTimezone = cache(async (): Promise<string> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("timezone")
    .maybeSingle();

  if (error) {
    // 42703 = column missing (migration 022 not applied) — expected, quiet.
    // Anything else is a real failure: log it so a silent Chicago fallback
    // during an outage is at least visible in Vercel logs.
    if (error.code !== "42703") {
      console.error(
        "getAppTimezone unexpected error",
        error.code,
        error.message,
      );
    }
    return DEFAULT_APP_TIMEZONE;
  }

  if (!data?.timezone || !isValidTimezone(data.timezone)) {
    return DEFAULT_APP_TIMEZONE;
  }

  return data.timezone;
});

/** Today's YYYY-MM-DD in the app timezone — THE "what day is it" answer. */
export async function getAppToday(): Promise<string> {
  return dateStringInTz(await getAppTimezone());
}

/** Today's day-of-week enum in the app timezone. */
export async function getAppDayOfWeek() {
  return dayOfWeekInTz(await getAppTimezone());
}

import { dayKeyDaysAgo } from "@/lib/time/appDay";
import { getAppTimezone } from "@/lib/time/server";
import { createClient } from "@/lib/supabase/server";

export type BodyweightLogRow = {
  log_date: string;
  weight_kg: number;
};

export type BodyweightTrendResult =
  | { available: true; rows: BodyweightLogRow[] }
  | { available: false };

// Trailing window of bodyweight logs, oldest first. Returns available: false
// (instead of throwing) when the bodyweight_logs table doesn't exist yet —
// the Trends page must not crash in the deploy-before-migration window.
export async function getBodyweightTrend(
  windowDays: number,
): Promise<BodyweightTrendResult> {
  const supabase = await createClient();
  // log_date is authored device-local; the window boundary must use the
  // APP_TIMEZONE day key, not the server's (UTC on Vercel) calendar day —
  // same convention as every other analytics window.
  const startDate = dayKeyDaysAgo(windowDays - 1, await getAppTimezone());

  const { data, error } = await supabase
    .from("bodyweight_logs")
    .select("log_date, weight_kg")
    .gte("log_date", startDate)
    .order("log_date", { ascending: true })
    .limit(1000);

  if (error) {
    // Missing table = migration 021 not applied yet. PostgREST surfaces this
    // as PGRST205 ("could not find the table ... in the schema cache");
    // 42P01 is the raw Postgres code kept as a belt-and-suspenders match.
    if (error.code === "PGRST205" || error.code === "42P01") {
      console.error("bodyweight_logs missing — apply migration 021");
      return { available: false };
    }

    throw new Error(`Failed to load bodyweight logs: ${error.message}`);
  }

  return { available: true, rows: data ?? [] };
}

// Ensures a profiles row exists for the test user (the app's auth callback
// normally does this; we bypass it when injecting a session directly).
// Run: node --env-file=.env.local e2e/_setup/prep-profile.mjs <userId>
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userId = process.argv[2];

if (!userId) {
  console.error("Usage: prep-profile.mjs <userId>");
  process.exit(1);
}

const admin = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { error } = await admin
  .from("profiles")
  .upsert(
    { user_id: userId, goal_mode: "maintain" },
    { onConflict: "user_id", ignoreDuplicates: true },
  );

if (error) {
  console.error("profile upsert failed:", error.message);
  process.exit(1);
}
console.log("profile ready for", userId);

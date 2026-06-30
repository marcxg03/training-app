// Removes the Slice 7b e2e test user and all data created under it.
// Deleting the auth user cascades to profile + catalog rows via FK ON DELETE CASCADE.
// Run: node --env-file=.env.local e2e/_setup/cleanup-auth.mjs
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = "e2e-slice7b@trainingapp.test";

const admin = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
const user = list?.users?.find((u) => u.email === EMAIL);

if (!user) {
  console.log("No test user found — nothing to clean up.");
  process.exit(0);
}

const { error } = await admin.auth.admin.deleteUser(user.id);
if (error) {
  console.error("deleteUser failed:", error.message);
  process.exit(1);
}

// Verify no residual rows remain for this user across the catalog tables.
const checks = {
  blocks: ["owner_user_id", user.id],
  exercises: ["user_id", user.id],
  cardio_activities: ["owner_user_id", user.id],
  recovery_activities: ["owner_user_id", user.id],
  profiles: ["user_id", user.id],
};
const residual = {};
for (const [table, [col, val]] of Object.entries(checks)) {
  const { count } = await admin
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(col, val);
  residual[table] = count ?? 0;
}
console.log("Deleted test user", user.id);
console.log("Residual rows:", JSON.stringify(residual));

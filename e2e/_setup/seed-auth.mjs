// Seeds a confirmed test user and prints the exact @supabase/ssr cookies needed
// to inject an authenticated browser session (no email round-trip).
//
// Run:  node --env-file=.env.local e2e/_setup/seed-auth.mjs
// Prints a single JSON line: { userId, cookies: [{name, value}], email }
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON || !SERVICE) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}

const EMAIL = "e2e-slice7b@trainingapp.test";
const PASSWORD = "Slice7b-e2e-pw!2026";

const admin = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 1. Create (idempotent) a confirmed user with a password.
let userId;
const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
});

if (createErr) {
  // Likely already exists — find it and reset the password to be safe.
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users?.find((u) => u.email === EMAIL);
  if (!existing) {
    console.error("createUser failed and user not found:", createErr.message);
    process.exit(1);
  }
  userId = existing.id;
  await admin.auth.admin.updateUserById(userId, {
    password: PASSWORD,
    email_confirm: true,
  });
} else {
  userId = created.user.id;
}

// 2. Sign in through a capturing @supabase/ssr server client so the cookies are
//    serialized in exactly the format the app's middleware/server client expects.
const jar = {};
const ssr = createServerClient(URL, ANON, {
  cookies: {
    getAll: () => Object.entries(jar).map(([name, value]) => ({ name, value })),
    setAll: (toSet) =>
      toSet.forEach(({ name, value }) => {
        if (value === "") delete jar[name];
        else jar[name] = value;
      }),
  },
});

const { error: signInErr } = await ssr.auth.signInWithPassword({
  email: EMAIL,
  password: PASSWORD,
});

if (signInErr) {
  console.error("signInWithPassword failed:", signInErr.message);
  process.exit(1);
}

const cookies = Object.entries(jar).map(([name, value]) => ({ name, value }));
console.log(JSON.stringify({ userId, email: EMAIL, cookies }));

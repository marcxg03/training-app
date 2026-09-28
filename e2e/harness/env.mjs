// Env + service-role client for the e2e harness.
//
// Mirrors e2e/_setup/env.ts (which is TS and therefore unusable from a plain
// .mjs drive script) so a drive can `import { admin } from "./harness/env.mjs"`
// without `node --env-file=` gymnastics or a dotenv dependency.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

/** Repo root — every harness path is resolved against this, not against cwd,
 * so a drive can be run from anywhere. fileURLToPath (not URL.pathname) because
 * the repo lives under "Coding Projects" and a %20 in a spawn cwd is an
 * unexplainable ENOENT. */
export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

function parseEnvFile(file) {
  const out = {};

  if (!existsSync(file)) {
    return out;
  }

  for (const rawLine of readFileSync(file, "utf8").split("\n")) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const eq = line.indexOf("=");

    if (eq === -1) {
      continue;
    }

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    out[key] = value;
  }

  return out;
}

const fileEnv = parseEnvFile(path.join(REPO_ROOT, ".env.local"));

export function env(key, fallback) {
  const value = process.env[key] ?? fileEnv[key] ?? fallback;

  if (value === undefined) {
    throw new Error(`Missing env var required by the e2e harness: ${key}`);
  }

  return value;
}

export const SUPABASE_URL = () => env("NEXT_PUBLIC_SUPABASE_URL");
export const SUPABASE_SERVICE_ROLE_KEY = () => env("SUPABASE_SERVICE_ROLE_KEY");

/** The ONLY account any harness-driven test may touch. Every seed/cleanup
 * script gates on this suffix; Marcus's real account can never match it. */
export const TEST_EMAIL_SUFFIX = "@trainingapp.test";

/** Port the harness expects `next dev` on. Deliberately NOT 3000 so a drive
 * can never collide with a hand-started dev server on the default port. */
export const PORT = Number(process.env.E2E_PORT ?? 3111);
export const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

let adminClient = null;

/** Service-role Supabase client (RLS bypassed). Use ONLY with ids that came
 * out of startSession() — see assertTestUser below. */
export function admin() {
  if (adminClient === null) {
    adminClient = createClient(SUPABASE_URL(), SUPABASE_SERVICE_ROLE_KEY(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  return adminClient;
}

/** Hard safety gate. Throws unless `userId` is a throwaway e2e account, so a
 * copy-pasted uuid can never point a service-role DELETE at real data. */
export async function assertTestUser(userId) {
  const { data, error } = await admin().auth.admin.getUserById(userId);
  const email = data?.user?.email;

  if (error || !email || !email.endsWith(TEST_EMAIL_SUFFIX)) {
    throw new Error(
      `REFUSING to operate on user ${userId}: not a ${TEST_EMAIL_SUFFIX} e2e account` +
        (error ? ` (${error.message})` : ` (email: ${email ?? "unknown"})`),
    );
  }

  return email;
}

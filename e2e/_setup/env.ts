import * as fs from "node:fs";
import * as path from "node:path";

// Minimal .env.local loader so the e2e harness doesn't need dotenv.
function loadEnvLocal(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const out: Record<string, string> = {};

  if (!fs.existsSync(envPath)) {
    return out;
  }

  const contents = fs.readFileSync(envPath, "utf8");

  for (const rawLine of contents.split("\n")) {
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

const fileEnv = loadEnvLocal();

function required(key: string): string {
  const value = process.env[key] ?? fileEnv[key];
  if (!value) {
    throw new Error(`Missing required env var for e2e: ${key}`);
  }
  return value;
}

export const SUPABASE_URL = required("NEXT_PUBLIC_SUPABASE_URL");
export const SUPABASE_ANON_KEY = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
export const SUPABASE_SERVICE_ROLE_KEY = required("SUPABASE_SERVICE_ROLE_KEY");

export const TEST_USER_EMAIL = "e2e-slice7b@trainingapp.test";
export const TEST_USER_PASSWORD = "Slice7b-e2e-pw!2026";

export const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
export const STORAGE_STATE_PATH = path.resolve(
  process.cwd(),
  "e2e/.auth/state.json",
);

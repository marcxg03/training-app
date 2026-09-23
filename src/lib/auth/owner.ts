/**
 * Owner-gate (Slice S0 · D22) — pure, dependency-free authorization predicate.
 *
 * Authoring surfaces (the Library builder, plan/day editing, the future /admin
 * hub — D18) are owner-only. Ownership is decided server-side by matching the
 * authenticated user's id against a comma-separated allow-list carried in the
 * SERVER-ONLY env var `OWNER_USER_IDS` (no `NEXT_PUBLIC_` prefix — it must never
 * reach the client bundle). No schema change (D22): this replaces a
 * `profiles.is_owner` column.
 *
 * FAIL-CLOSED: an unset or empty `OWNER_USER_IDS`, or a null/undefined userId,
 * means NOBODY is an owner. A missing allow-list locks authoring down rather
 * than opening it up.
 *
 * This module intentionally imports nothing (no Next, no Supabase) so the pure
 * predicate is unit-testable under plain `tsx` (see scripts/verify-owner-gate.ts).
 * The request-time server guard lives in `./requireOwner` (it pulls in Supabase
 * + next/navigation).
 *
 * SETUP: add Marcus's real Supabase user id to `.env.local` and to Vercel's env
 * (Production + Preview), e.g. `OWNER_USER_IDS=<marcus-supabase-user-uuid>`.
 * Comma-separate to allow more than one owner. Do NOT hardcode a real id here.
 */

/** Parse the allow-list env var into trimmed, non-empty ids. */
export function getOwnerUserIds(): string[] {
  return (process.env.OWNER_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

/**
 * True only when `userId` is a non-empty string present in `OWNER_USER_IDS`.
 * Fail-closed: null/undefined/empty userId or an empty allow-list ⇒ false.
 */
export function isOwner(userId: string | null | undefined): boolean {
  if (!userId) {
    return false;
  }
  return getOwnerUserIds().includes(userId);
}

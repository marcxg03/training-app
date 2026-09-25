// The Body area's weight control takes an OPTIONAL date (blank = today). This
// is the gate between what a user can type into that field and the `logDate`
// argument logBodyweight() already takes — the mutation's signature is
// unchanged, it just stops always receiving "today".
//
// Pure, and compared LEXICALLY. 'YYYY-MM-DD' strings sort correctly as text,
// so `entered > today` is an exact day comparison; parsing either side through
// `new Date()` would move the boundary by a timezone offset and quietly admit
// tomorrow's date (the app clock is the profile's timezone, not the browser's
// — see lib/time/appDay.ts).

export type NormalizedLogDate =
  | { ok: true; date: string }
  | { ok: false; error: string };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** True only if the string names a calendar day that exists (rejects
 * 2026-02-30 and month 13, which the regex alone lets through). */
function isRealCalendarDay(dayKey: string): boolean {
  const [year, month, day] = dayKey.split("-").map(Number);
  // Noon UTC so the round-trip can never be nudged across a boundary.
  const probe = new Date(Date.UTC(year, month - 1, day, 12));

  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/**
 * @param raw   whatever is in the date input ('' when the user left it alone)
 * @param today today's day key per the APP clock, authored server-side
 */
export function normalizeLogDate(
  raw: string | undefined | null,
  today: string,
): NormalizedLogDate {
  const trimmed = (raw ?? "").trim();

  if (trimmed === "") {
    return { ok: true, date: today };
  }

  if (!ISO_DAY.test(trimmed) || !isRealCalendarDay(trimmed)) {
    return { ok: false, error: "Pick a real date (YYYY-MM-DD)." };
  }

  if (trimmed > today) {
    return { ok: false, error: "That date is in the future." };
  }

  return { ok: true, date: trimmed };
}

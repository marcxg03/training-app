// Grouping + labelling for the progress-photo timeline.
//
// Every function here works on the 'YYYY-MM-DD' string directly and NEVER
// parses it through `new Date()`. `new Date('2026-01-01')` is midnight UTC,
// which renders as Dec 31 anywhere west of Greenwich — the same day-shift bug
// lib/time/appDay.ts exists to prevent. A photo dated Jan 1 must say Jan 1.

const MONTH_NAMES = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const;

/** 'SEP 2026' from a 'YYYY-MM' key. */
export function photoMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const name = MONTH_NAMES[Number(month) - 1];

  return name ? `${name} ${year}` : monthKey;
}

/** 'SEP 1' from a 'YYYY-MM-DD' day key (no leading zero on the day). */
export function photoDayLabel(dayKey: string): string {
  const [, month, day] = dayKey.split("-");
  const name = MONTH_NAMES[Number(month) - 1];

  return name ? `${name} ${Number(day)}` : dayKey;
}

export type TimelinePhoto = {
  taken_on: string;
  created_at: string;
};

export type PhotoMonthGroup<T extends TimelinePhoto> = {
  /** 'YYYY-MM' — unique per calendar month AND year. */
  key: string;
  label: string;
  photos: T[];
};

/**
 * Reverse-chronological months, each holding its photos newest-first.
 *
 * `taken_on` is the user's answer to "when was this me", so it orders the
 * timeline; `created_at` only breaks ties inside one day (several photos taken
 * on the same date). Returns a new array — the caller's list is not mutated,
 * because the server page hands the same array to more than one component.
 */
export function groupPhotosByMonth<T extends TimelinePhoto>(
  photos: T[],
): PhotoMonthGroup<T>[] {
  const sorted = [...photos].sort((a, b) => {
    if (a.taken_on !== b.taken_on) {
      return b.taken_on.localeCompare(a.taken_on);
    }

    return b.created_at.localeCompare(a.created_at);
  });

  const groups: PhotoMonthGroup<T>[] = [];
  const indexByKey = new Map<string, number>();

  for (const photo of sorted) {
    const key = photo.taken_on.slice(0, 7);
    const existing = indexByKey.get(key);

    if (existing === undefined) {
      indexByKey.set(key, groups.length);
      groups.push({ key, label: photoMonthLabel(key), photos: [photo] });
    } else {
      groups[existing].photos.push(photo);
    }
  }

  return groups;
}

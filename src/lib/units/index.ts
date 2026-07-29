export const KG_PER_LB = 0.45359237;
export const LB_PER_KG = 2.20462262;
export const DISPLAY_UNIT = "lbs" as const;

export function lbsToKg(lbs: number): number {
  if (!Number.isFinite(lbs) || lbs < 0) {
    return Number.NaN;
  }

  return Math.round(lbs * KG_PER_LB * 1000) / 1000;
}

export function kgToLbs(kg: number): number {
  if (!Number.isFinite(kg) || kg < 0) {
    return Number.NaN;
  }

  return kg * LB_PER_KG;
}

export function formatWeight(kg: number): string {
  if (!Number.isFinite(kg) || kg < 0) {
    return "—";
  }

  if (kg === 0) {
    return "Bodyweight";
  }

  return `${Math.round(kgToLbs(kg))} ${DISPLAY_UNIT}`;
}

// Chart adapter: convert a kg-valued trend series to display-lbs points in
// ONE place (delta math should use unrounded values; rounding happens here,
// last).
export function toLbsChartPoints(
  points: { label: string; value: number }[],
): { label: string; value: number }[] {
  return points.map((point) => ({
    label: point.label,
    value: Math.round(kgToLbs(point.value)),
  }));
}

// Tonnage display for volume stats (weight x reps summed across a range).
// k-suffix past 1000 lbs to keep the stat glanceable; an all-bodyweight
// group legitimately shows "0 lbs" (sets counted, no external load).
export function formatTonnage(kg: number): string {
  const lbs = kgToLbs(kg);

  if (!Number.isFinite(lbs) || lbs <= 0) {
    return `0 ${DISPLAY_UNIT}`;
  }

  if (lbs >= 1000) {
    return `${(lbs / 1000).toFixed(1)}k ${DISPLAY_UNIT}`;
  }

  return `${Math.round(lbs)} ${DISPLAY_UNIT}`;
}

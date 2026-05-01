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

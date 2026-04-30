export const wikiPaths = {
  overview: "supabase/seed/wiki/overview.md",
  masterPlan: "supabase/seed/wiki/master-plan.md",
  currentPlan: "supabase/seed/wiki/current-plan.md",
  trainingLog: "supabase/seed/wiki/training-log.md",
  nutrition: "supabase/seed/wiki/nutrition.md",
  planDecisions: "supabase/seed/wiki/plan-decisions.md",
} as const;

export const wikiPathList = Object.values(wikiPaths);

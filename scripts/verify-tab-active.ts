/**
 * verify-tab-active — pure test for the bottom-nav active matcher.
 * Guards S5's Progress swap: /history and /trends must keep lighting Progress
 * until (and after) the merged /progress screen replaces the placeholder.
 * Run: pnpm exec tsx scripts/verify-tab-active.ts
 */
import { isTabActive } from "../src/lib/nav/tabs";

let failed = 0;
function check(name: string, got: boolean, want: boolean) {
  if (got === want) {
    console.log(`✓ ${name}`);
  } else {
    console.error(`✗ ${name} — got ${got}, want ${want}`);
    failed++;
  }
}

const PROGRESS_MATCH = ["/history", "/trends"];

// Progress tab lights on its own route + the merged legacy surfaces (D19/S5).
check("/progress lights Progress", isTabActive("/progress", "/progress", PROGRESS_MATCH), true);
check("/history lights Progress", isTabActive("/history", "/progress", PROGRESS_MATCH), true);
check("/trends lights Progress", isTabActive("/trends", "/progress", PROGRESS_MATCH), true);
check("/history/workouts/123 lights Progress (nested)", isTabActive("/history/workouts/123", "/progress", PROGRESS_MATCH), true);
check("/trends/ (nested) lights Progress", isTabActive("/trends/anything", "/progress", PROGRESS_MATCH), true);

// It must NOT bleed onto unrelated tabs.
check("/today does NOT light Progress", isTabActive("/today", "/progress", PROGRESS_MATCH), false);
check("/nutrition does NOT light Progress", isTabActive("/nutrition", "/progress", PROGRESS_MATCH), false);

// Simple tabs: exact + nested, no false prefixes.
check("/plan lights Plan", isTabActive("/plan", "/plan"), true);
check("/plan/mon lights Plan (nested)", isTabActive("/plan/mon", "/plan"), true);
check("/plan-x does NOT light Plan (prefix guard)", isTabActive("/plan-x", "/plan"), false);
check("/today lights Today", isTabActive("/today", "/today"), true);
check("/community lights Community", isTabActive("/community", "/community"), true);

if (failed > 0) {
  console.error(`\n${failed} tab-active assertion(s) failed.`);
  process.exit(1);
}
console.log("\nAll tab-active assertions passed.");

import { redirect } from "next/navigation";

/**
 * /progress — S0 placeholder.
 *
 * The Progress tab (D19) points here, but the merged Overview / By exercise /
 * History screen is built in S5 (which absorbs /trends + /history). Until then
 * this redirects to the existing progress surface so the tab navigates.
 * S5 REPLACES this file with the real merged page.
 */
export default function ProgressPage() {
  redirect("/history");
}

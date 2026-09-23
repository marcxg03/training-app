import { redirect } from "next/navigation";

/**
 * /history/workouts — merged into the Progress tab's History segment (D19/S5).
 *
 * The all-workouts list is now rendered by the Progress History segment, which
 * lists every workout alongside the PR timeline. This index is redundant, so it
 * redirects to that segment. The per-session DETAIL route
 * (/history/workouts/[completion_id]) still resolves directly.
 */
export default function AllWorkoutsPage() {
  redirect("/progress?view=history");
}

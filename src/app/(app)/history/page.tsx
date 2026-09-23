import { redirect } from "next/navigation";

/**
 * /history — merged into the Progress tab (D19/S5).
 *
 * The PR timeline + all-workouts list were re-homed into /progress (History
 * segment). This index redirects so old links and the Progress tab's
 * activeMatch resolve. The DEEP-LINK detail routes stay where they are:
 * /history/workouts, /history/workouts/[completion_id], and
 * /history/exercises/[exercise_id] still resolve directly (Progress links into
 * them via crossLinks). The history _components live on and are imported by
 * /progress and by those detail routes.
 */
export default function HistoryPage() {
  redirect("/progress");
}

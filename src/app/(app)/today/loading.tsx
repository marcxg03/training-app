import {
  SkeletonBox,
  SkeletonHeader,
  SkeletonList,
  SkeletonScreen,
} from "@/components/shared/Skeleton";

/**
 * Instant shape for /today (T3-D).
 *
 * Matches the real screen's layout — one big focal start card, then the
 * smaller rows beneath it. A skeleton whose proportions do not match what
 * arrives makes the content "jump" on load, which is a different kind of
 * jarring from the one it is fixing.
 */
export default function Loading() {
  return (
    <SkeletonScreen label="Loading today">
      <SkeletonHeader />
      <SkeletonBox className="h-44 w-full rounded-2xl" />
      <SkeletonList rows={2} height="h-16" />
    </SkeletonScreen>
  );
}

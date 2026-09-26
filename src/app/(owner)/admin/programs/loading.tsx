import {
  SkeletonHeader,
  SkeletonList,
  SkeletonScreen,
} from "@/components/shared/Skeleton";

/** Instant shape for the Programs list (T3-D). */
export default function Loading() {
  return (
    <SkeletonScreen label="Loading programs">
      <SkeletonHeader />
      <SkeletonList rows={3} height="h-28" />
    </SkeletonScreen>
  );
}

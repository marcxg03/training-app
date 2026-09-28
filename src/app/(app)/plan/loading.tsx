import {
  SkeletonHeader,
  SkeletonList,
  SkeletonScreen,
} from "@/components/shared/Skeleton";

/** Instant shape for /plan while its server queries run (T3-D). */
export default function Loading() {
  return (
    <SkeletonScreen label="Loading plan">
      <SkeletonHeader />
      <SkeletonList rows={3} height="h-24" />
    </SkeletonScreen>
  );
}

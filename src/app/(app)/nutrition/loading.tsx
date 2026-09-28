import {
  SkeletonHeader,
  SkeletonList,
  SkeletonScreen,
} from "@/components/shared/Skeleton";

/** Instant shape for /nutrition while its server queries run (T3-D). */
export default function Loading() {
  return (
    <SkeletonScreen label="Loading nutrition">
      <SkeletonHeader />
      <SkeletonList rows={3} height="h-24" />
    </SkeletonScreen>
  );
}

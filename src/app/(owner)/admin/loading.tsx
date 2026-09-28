import {
  SkeletonBox,
  SkeletonHeader,
  SkeletonScreen,
} from "@/components/shared/Skeleton";

/** Instant shape for the admin hub's Overview (T3-D). */
export default function Loading() {
  return (
    <SkeletonScreen label="Loading the admin hub">
      <SkeletonHeader />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonBox key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    </SkeletonScreen>
  );
}

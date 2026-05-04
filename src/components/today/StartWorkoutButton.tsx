"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

type StartWorkoutButtonProps = {
  workoutId: string;
};

export function StartWorkoutButton({ workoutId }: StartWorkoutButtonProps) {
  return (
    <Link
      href={`/log/${workoutId}`}
      onClick={(event) => {
        event.stopPropagation();
      }}
      className={cn(buttonVariants({ size: "sm" }), "w-full sm:w-auto")}
    >
      Start Workout
    </Link>
  );
}

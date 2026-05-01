"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

type StartWorkoutButtonProps = {
  sessionId: string;
};

export function StartWorkoutButton({ sessionId }: StartWorkoutButtonProps) {
  return (
    <Link
      href={`/log/${sessionId}`}
      onClick={(event) => {
        event.stopPropagation();
      }}
      className={cn(buttonVariants({ size: "sm" }), "w-full sm:w-auto")}
    >
      Start Workout
    </Link>
  );
}

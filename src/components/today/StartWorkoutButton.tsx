"use client";

import Link from "next/link";
import { Play } from "lucide-react";

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
      className={cn(
        buttonVariants(),
        "w-full gap-2 text-[13px] font-bold uppercase tracking-[0.08em]",
      )}
    >
      <Play className="h-[18px] w-[18px]" fill="currentColor" />
      Start Workout
    </Link>
  );
}

import Link from "next/link";
import { Plus } from "lucide-react";

import { workoutCreateHref } from "@/lib/library/crossLinks";
import { cn } from "@/lib/utils/cn";

type AddWorkoutButtonProps = {
  className?: string;
};

export function AddWorkoutButton({ className }: AddWorkoutButtonProps) {
  return (
    <Link
      href={workoutCreateHref()}
      className={cn(
        "flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 text-[13px] font-bold uppercase tracking-[0.08em] text-black transition-colors hover:bg-accent/90",
        className,
      )}
    >
      <Plus className="h-[18px] w-[18px]" />
      Add Workout
    </Link>
  );
}

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { workoutCreateHref } from "@/lib/library/crossLinks";
import { cn } from "@/lib/utils/cn";

type AddWorkoutButtonProps = {
  className?: string;
};

export function AddWorkoutButton({ className }: AddWorkoutButtonProps) {
  return (
    <Link
      href={workoutCreateHref()}
      className={cn(buttonVariants({ variant: "default" }), className)}
    >
      Add workout
    </Link>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";

import { workoutDetailHref } from "@/lib/history/crossLinks";
import { cn } from "@/lib/utils/cn";

type WorkoutLinkProps = {
  completionId: string;
  children: ReactNode;
  className?: string;
};

export function WorkoutLink({
  completionId,
  children,
  className,
}: WorkoutLinkProps) {
  return (
    <Link href={workoutDetailHref(completionId)} className={cn(className)}>
      {children}
    </Link>
  );
}

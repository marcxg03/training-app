import type { ReactNode } from "react";
import Link from "next/link";

import { exerciseProgressHref } from "@/lib/history/crossLinks";
import { cn } from "@/lib/utils/cn";

type ExerciseLinkProps = {
  exerciseId: string;
  children: ReactNode;
  className?: string;
};

export function ExerciseLink({
  exerciseId,
  children,
  className,
}: ExerciseLinkProps) {
  return (
    <Link href={exerciseProgressHref(exerciseId)} className={cn(className)}>
      {children}
    </Link>
  );
}

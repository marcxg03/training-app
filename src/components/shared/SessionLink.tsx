import type { ReactNode } from "react";
import Link from "next/link";

import { sessionDetailHref } from "@/lib/history/crossLinks";
import { cn } from "@/lib/utils/cn";

type SessionLinkProps = {
  completionId: string;
  children: ReactNode;
  className?: string;
};

export function SessionLink({
  completionId,
  children,
  className,
}: SessionLinkProps) {
  return (
    <Link href={sessionDetailHref(completionId)} className={cn(className)}>
      {children}
    </Link>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";

import { blockDetailHref } from "@/lib/library/crossLinks";
import { cn } from "@/lib/utils/cn";

type BlockLinkProps = {
  blockId: string;
  children: ReactNode;
  className?: string;
};

export function BlockLink({ blockId, children, className }: BlockLinkProps) {
  return (
    <Link href={blockDetailHref(blockId)} className={cn(className)}>
      {children}
    </Link>
  );
}

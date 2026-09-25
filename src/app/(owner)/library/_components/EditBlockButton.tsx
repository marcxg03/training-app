import Link from "next/link";
import { Pencil } from "lucide-react";

import { blockEditHref } from "@/lib/library/crossLinks";
import { cn } from "@/lib/utils/cn";

type EditBlockButtonProps = {
  blockId: string;
  className?: string;
};

export function EditBlockButton({ blockId, className }: EditBlockButtonProps) {
  return (
    <Link
      href={blockEditHref(blockId)}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-accent transition-colors hover:text-accent/80",
        className,
      )}
    >
      <Pencil className="h-[17px] w-[17px]" />
      Edit Block
    </Link>
  );
}

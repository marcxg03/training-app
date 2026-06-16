import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
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
      className={cn(buttonVariants({ variant: "outline" }), className)}
    >
      Edit
    </Link>
  );
}

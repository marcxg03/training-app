import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { blockCreateHref } from "@/lib/library/crossLinks";
import { cn } from "@/lib/utils/cn";

type AddBlockButtonProps = {
  className?: string;
};

export function AddBlockButton({ className }: AddBlockButtonProps) {
  return (
    <Link
      href={blockCreateHref()}
      className={cn(buttonVariants({ variant: "default" }), className)}
    >
      Add lifting block
    </Link>
  );
}

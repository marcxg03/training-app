import Link from "next/link";
import { Plus } from "lucide-react";

import { blockCreateHref } from "@/lib/library/crossLinks";
import { cn } from "@/lib/utils/cn";

type AddBlockButtonProps = {
  className?: string;
};

export function AddBlockButton({ className }: AddBlockButtonProps) {
  return (
    <Link
      href={blockCreateHref()}
      className={cn(
        "flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 text-[13px] font-bold uppercase tracking-[0.08em] text-black transition-colors hover:bg-accent/90",
        className,
      )}
    >
      <Plus className="h-[18px] w-[18px]" />
      Add Block
    </Link>
  );
}

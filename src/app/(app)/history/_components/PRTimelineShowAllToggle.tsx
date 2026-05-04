"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

type PRTimelineShowAllToggleProps = {
  showAll: boolean;
};

export function PRTimelineShowAllToggle({
  showAll,
}: PRTimelineShowAllToggleProps) {
  return (
    <Link
      href={showAll ? "/history" : "/history?showAll=1"}
      className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}
    >
      {showAll ? "Show last 90 days" : "Show all"}
    </Link>
  );
}

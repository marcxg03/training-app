"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  cardioHref,
  liftingHref,
  recoveryHref,
} from "@/lib/library/crossLinks";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const tabs = [
  { href: liftingHref(), label: "Lifting", value: "lifting" },
  { href: cardioHref(), label: "Cardio", value: "cardio" },
  { href: recoveryHref(), label: "Recovery", value: "recovery" },
] as const;

function getActiveValue(pathname: string) {
  if (pathname.startsWith(cardioHref())) {
    return "cardio";
  }

  if (pathname.startsWith(recoveryHref())) {
    return "recovery";
  }

  return "lifting";
}

export function LibraryTabs() {
  const pathname = usePathname();

  return (
    <Tabs value={getActiveValue(pathname)} className="w-full">
      <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-card/80 p-1">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.href}
            value={tab.value}
            asChild
            className="min-h-11 rounded-xl text-sm"
          >
            <Link href={tab.href}>{tab.label}</Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

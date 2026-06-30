import { Moon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export function RestDayEmpty() {
  return (
    <Card className="bg-card">
      <CardContent className="flex min-h-48 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/[0.12] text-accent">
          <Moon className="h-6 w-6" />
        </span>
        <div className="space-y-1">
          <p className="text-base font-semibold text-foreground">Rest day</p>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-faint">
            No sessions today · recover well
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

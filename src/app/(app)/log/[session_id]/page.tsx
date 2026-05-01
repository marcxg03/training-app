import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LogPlaceholderPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-2xl items-center justify-center">
      <Card className="w-full bg-card/80 text-center">
        <CardHeader className="space-y-3">
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
            Workout Logger
          </p>
          <CardTitle className="text-3xl tracking-tight">
            Workout logger coming in Slice 4
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Link
            href="/today"
            className="text-sm font-medium text-accent transition-colors hover:text-accent/80"
          >
            Back to today
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

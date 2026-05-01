import { Card, CardContent } from "@/components/ui/card";

export function RestDayEmpty() {
  return (
    <Card className="mx-auto max-w-2xl bg-card/80">
      <CardContent className="flex min-h-48 items-center justify-center px-6 py-12 text-center">
        <p className="text-base font-medium text-muted-foreground">
          No sessions today. Rest up.
        </p>
      </CardContent>
    </Card>
  );
}

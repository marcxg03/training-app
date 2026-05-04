import type { RecoveryActivity } from "@/lib/library/projections";

type RecoveryActivityCardProps = {
  activity: RecoveryActivity;
};

export function RecoveryActivityCard({ activity }: RecoveryActivityCardProps) {
  return (
    <li className="rounded-2xl border border-border/70 bg-card/80 px-4 py-4">
      <p className="text-base font-semibold text-foreground">{activity.name}</p>
      {activity.description ? (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {activity.description}
        </p>
      ) : null}
    </li>
  );
}

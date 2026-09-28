import { DeleteLibraryItemButton } from "@/app/(owner)/library/_components/DeleteLibraryItemButton";
import { EditPencilButton } from "@/app/(owner)/library/_components/EditPencilButton";
import type { CardioActivity } from "@/lib/library/projections";
import { formatCardioSummary } from "@/lib/library/displayName";
import { CardioFormatBadge } from "@/app/(owner)/library/_components/CardioFormatBadge";

type CardioActivityCardProps = {
  activity: CardioActivity;
};

export function CardioActivityCard({ activity }: CardioActivityCardProps) {
  const summary = formatCardioSummary(activity);

  return (
    <li className="rounded-[13px] border border-border bg-card px-[15px] py-4">
      <div className="flex items-center gap-2">
        <span className="truncate text-[15px] font-semibold text-foreground">
          {activity.name}
        </span>
        <CardioFormatBadge cardioFormat={activity.cardio_format} />
        <div className="ml-auto flex flex-none items-center gap-2">
          <EditPencilButton kind="cardio" activity={activity} />
          <DeleteLibraryItemButton
            kind="cardio"
            id={activity.activity_id}
            name={activity.name}
          />
        </div>
      </div>
      {summary ? (
        <p className="mt-1.5 font-mono text-[11px] uppercase tabular-nums tracking-[0.06em] text-muted-foreground">
          {summary}
        </p>
      ) : null}
      {activity.description ? (
        <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">
          {activity.description}
        </p>
      ) : null}
    </li>
  );
}

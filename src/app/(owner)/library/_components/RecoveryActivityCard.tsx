import { DeleteLibraryItemButton } from "@/app/(owner)/library/_components/DeleteLibraryItemButton";
import { EditPencilButton } from "@/app/(owner)/library/_components/EditPencilButton";
import type { RecoveryActivity } from "@/lib/library/projections";

type RecoveryActivityCardProps = {
  activity: RecoveryActivity;
};

export function RecoveryActivityCard({ activity }: RecoveryActivityCardProps) {
  return (
    <li className="rounded-[13px] border border-border bg-card px-[15px] py-4">
      <div className="flex items-center gap-2">
        <span className="truncate text-[15px] font-semibold text-foreground">
          {activity.name}
        </span>
        <span className="inline-flex items-center rounded-md border border-success/40 px-1.5 py-0.5 font-mono text-[8.5px] font-semibold uppercase tracking-[0.1em] text-success">
          Recovery
        </span>
        <div className="ml-auto flex flex-none items-center gap-2">
          <EditPencilButton kind="recovery" activity={activity} />
          <DeleteLibraryItemButton
            kind="recovery"
            id={activity.activity_id}
            name={activity.name}
          />
        </div>
      </div>
      {activity.description ? (
        <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">
          {activity.description}
        </p>
      ) : null}
    </li>
  );
}

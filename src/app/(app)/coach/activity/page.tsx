import { ActivityRow } from "@/components/coach/ActivityRow";
import { CoachTabBar } from "@/components/coach/CoachTabBar";
import { getActivityFeed } from "@/lib/coach/queries";
import type { ActivityItem } from "@/lib/coach/types";

const BUCKET_LABELS: { key: ActivityItem["bucket"]; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "earlier", label: "Earlier" },
];

export default async function CoachActivityPage() {
  const feed = await getActivityFeed();

  return (
    <div className="-mx-6 -my-8 flex min-h-[calc(100vh-0px)] flex-col">
      <div className="px-6 pb-3 pt-4">
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground">
          Activity
        </h1>
      </div>

      <div className="flex-1 space-y-5 px-6 pb-4">
        {feed.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
            No client activity yet
          </div>
        ) : null}
        {BUCKET_LABELS.map(({ key, label }) => {
          const items = feed.filter((item) => item.bucket === key);
          if (items.length === 0) {
            return null;
          }

          return (
            <section key={key} className="space-y-2.5">
              <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-faint">
                {label}
              </p>
              <div className="space-y-2">
                {items.map((item) => (
                  <ActivityRow key={item.id} item={item} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <CoachTabBar />
    </div>
  );
}

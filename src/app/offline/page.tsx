import { CheckCircle2, CloudOff } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Offline — Training",
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-8 text-center">
      <span className="flex h-[60px] w-[60px] items-center justify-center rounded-2xl border border-border bg-card text-subtle">
        <CloudOff className="h-7 w-7" />
      </span>
      <h1 className="mt-[18px] text-2xl font-semibold tracking-tight text-foreground">
        You&apos;re offline
      </h1>
      <p className="mt-2.5 max-w-sm text-sm leading-relaxed text-subtle">
        Training needs a connection to load your plan and history. But
        don&apos;t worry —
      </p>

      <div className="mt-5 flex w-full max-w-sm items-center gap-3 rounded-xl border border-success/30 bg-success/[0.07] p-4 text-left">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
        <div>
          <p className="text-sm font-semibold text-foreground">
            Logging still works
          </p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-wide text-success">
            Anything you logged is saved and will sync
          </p>
        </div>
      </div>

      <Link
        href="/today"
        className="mt-3.5 w-full max-w-sm rounded-xl bg-accent px-4 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-black transition-colors hover:bg-accent/90"
      >
        Go to Today
      </Link>
      <a
        href="/today"
        className="mt-2.5 w-full max-w-sm rounded-xl border border-border bg-transparent px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-foreground transition-colors hover:bg-card-alt"
      >
        Retry
      </a>
    </main>
  );
}

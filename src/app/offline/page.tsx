export const metadata = {
  title: "Offline — Training",
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <h1 className="text-2xl font-semibold text-foreground">
        You&apos;re offline
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Training needs a connection to load your plan and history. Reconnect and
        try again — anything you logged is saved locally and will sync.
      </p>
    </main>
  );
}

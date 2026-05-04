type EmptyStateProps = {
  message: string;
};

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-border/80 bg-card/80 px-6 py-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

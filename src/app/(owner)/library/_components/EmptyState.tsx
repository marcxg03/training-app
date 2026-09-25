type EmptyStateProps = {
  message: string;
};

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="rounded-[var(--radius)] border border-dashed border-border bg-card-alt px-6 py-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

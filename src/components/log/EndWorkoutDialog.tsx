"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type EndWorkoutDialogProps = {
  disabled?: boolean;
  onConfirm: () => Promise<void>;
};

export function EndWorkoutDialog({
  disabled = false,
  onConfirm,
}: EndWorkoutDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleConfirm() {
    setError(null);
    setIsSubmitting(true);

    try {
      await onConfirm();
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Could not end the workout right now.";

      setError(message);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    setIsOpen(false);
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!isSubmitting) {
          setIsOpen(nextOpen);
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="text-sm font-medium text-accent transition hover:text-accent/80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          End workout early
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>End workout now?</DialogTitle>
          <DialogDescription>
            Any incomplete blocks will be marked as skipped.
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isSubmitting}
          >
            Keep logging
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? "Ending..." : "End workout"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

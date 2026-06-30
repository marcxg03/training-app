"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";

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
          className="inline-flex items-center rounded-[10px] border border-danger/40 bg-danger/[0.08] px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-danger transition hover:bg-danger/[0.14] disabled:cursor-not-allowed disabled:opacity-50"
        >
          End
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="items-start text-left">
          <span className="flex h-12 w-12 items-center justify-center rounded-[13px] bg-danger/10 text-danger">
            <LogOut className="h-6 w-6" />
          </span>
          <DialogTitle className="pt-3 text-[19px]">
            End workout early?
          </DialogTitle>
          <DialogDescription className="leading-6">
            Everything you&apos;ve logged is already saved — incomplete blocks
            will be marked as skipped and you can pick this up from History.
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <DialogFooter className="gap-2.5 sm:gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isSubmitting}
            className="flex-1 uppercase tracking-[0.05em]"
          >
            Keep going
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="flex-1 bg-danger uppercase tracking-[0.05em] text-background hover:bg-danger/90"
          >
            {isSubmitting ? "Ending…" : "End now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { LogOut, X } from "lucide-react";

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
      {/* "End workout", not "End" — the logger also offers an Exit that simply
          leaves the session running (T2-D), and a one-word label made the two
          look like the same escape hatch. Danger color + the ✕ mark this one as
          the terminal action; Exit is a muted back chevron on the other side of
          the bar. Behaviour below is unchanged. */}
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded-[10px] px-1 py-1 text-[13px] font-medium text-danger transition hover:text-danger/80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="h-4 w-4" />
          End workout
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

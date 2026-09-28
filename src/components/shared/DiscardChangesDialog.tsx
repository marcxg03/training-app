"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DiscardChangesDialogProps = {
  open: boolean;
  onCancel: () => void;
  onDiscard: () => void;
};

export function DiscardChangesDialog({
  open,
  onCancel,
  onDiscard,
}: DiscardChangesDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => (!nextOpen ? onCancel() : undefined)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Discard changes?</DialogTitle>
          <DialogDescription>
            You have unsaved edits. Discard them and leave this form?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={onDiscard}>
            Discard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type UseDiscardChangesGuardArgs = {
  isDirty: boolean;
};

export function useDiscardChangesGuard({
  isDirty,
}: UseDiscardChangesGuardArgs) {
  const [open, setOpen] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const ignoreNextPopRef = useRef(false);

  const requestConfirmation = useCallback(
    (action: () => void) => {
      if (!isDirty) {
        action();
        return;
      }

      pendingActionRef.current = action;
      setOpen(true);
    },
    [isDirty],
  );

  const cancelDiscard = useCallback(() => {
    pendingActionRef.current = null;
    setOpen(false);
  }, []);

  const confirmDiscard = useCallback(() => {
    const action = pendingActionRef.current;

    pendingActionRef.current = null;
    setOpen(false);
    action?.();
  }, []);

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    window.history.pushState({ discardGuard: true }, "", window.location.href);

    const handlePopState = () => {
      if (ignoreNextPopRef.current) {
        ignoreNextPopRef.current = false;
        return;
      }

      pendingActionRef.current = () => {
        ignoreNextPopRef.current = true;
        window.history.back();
      };

      setOpen(true);
      window.history.pushState(
        { discardGuard: true },
        "",
        window.location.href,
      );
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isDirty]);

  return {
    discardDialog: (
      <DiscardChangesDialog
        open={open}
        onCancel={cancelDiscard}
        onDiscard={confirmDiscard}
      />
    ),
    requestConfirmation,
  };
}

"use client";

import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteLibraryItem,
  getDeletionImpact,
  type DeletionImpact,
  type LibraryItemKind,
} from "@/lib/library/mutations";
import { createClient } from "@/lib/supabase/client";

type DeleteLibraryItemButtonProps = {
  kind: LibraryItemKind;
  id: string;
  name: string;
  /** Where to go after a successful delete. Omit to refresh in place (lists). */
  redirectTo?: string;
  /**
   * Trigger presentation. "icon" (default) is the bare trash icon used in
   * list rows; "bar" is the full-width labeled danger button used on detail
   * screens. Visual only — both open the same impact-check dialog.
   */
  variant?: "icon" | "bar";
};

const KIND_LABEL: Record<LibraryItemKind, string> = {
  block: "block",
  exercise: "exercise",
  cardio: "cardio activity",
  recovery: "recovery activity",
  workout: "workout",
};

export function DeleteLibraryItemButton({
  kind,
  id,
  name,
  redirectTo,
  variant = "icon",
}: DeleteLibraryItemButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [impact, setImpact] = useState<DeletionImpact | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = async (next: boolean) => {
    setOpen(next);
    if (!next) {
      setImpact(null);
      setError(null);
      return;
    }
    // Check what deleting would affect as soon as the dialog opens.
    setImpact(null);
    setError(null);
    setImpact(await getDeletionImpact(createClient(), kind, id));
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setError(null);
    const result = await deleteLibraryItem(createClient(), kind, id);
    setDeleting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    if (redirectTo) {
      router.push(redirectTo);
    } else {
      router.refresh();
    }
  };

  const checking = impact === null && !error;
  const blocked = impact?.blocked ?? false;

  return (
    <>
      {variant === "bar" ? (
        <button
          type="button"
          onClick={() => void handleOpenChange(true)}
          className="flex min-h-11 w-full items-center justify-center rounded-xl border border-danger/40 bg-danger/[0.06] px-4 py-3.5 text-[13px] font-semibold uppercase tracking-[0.06em] text-danger transition-colors hover:bg-danger/10"
        >
          Delete {KIND_LABEL[kind]}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void handleOpenChange(true)}
          aria-label={`Delete ${KIND_LABEL[kind]}`}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-danger/80 transition-colors hover:bg-danger/10 hover:text-danger"
        >
          <Trash2 className="h-[18px] w-[18px]" />
        </button>
      )}

      <Dialog open={open} onOpenChange={(next) => void handleOpenChange(next)}>
        <DialogContent>
          <DialogHeader>
            <div className="flex h-12 w-12 items-center justify-center rounded-[13px] bg-danger/10">
              <AlertTriangle className="h-6 w-6 text-danger" />
            </div>
            <DialogTitle>
              {blocked ? "Can't delete this" : `Delete “${name}”?`}
            </DialogTitle>
            <DialogDescription>
              {checking
                ? "Checking whether this is safe to delete…"
                : blocked
                  ? impact?.reason
                  : `This permanently removes the ${KIND_LABEL[kind]}.${
                      impact?.warning ? ` ${impact.warning}` : ""
                    }`}
            </DialogDescription>
          </DialogHeader>

          {!checking && !blocked ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-faint">
              Logged set history is kept · never deleted
            </p>
          ) : null}

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleOpenChange(false)}
            >
              {blocked ? "Close" : "Cancel"}
            </Button>
            {!blocked ? (
              <Button
                type="button"
                onClick={confirmDelete}
                disabled={checking || deleting}
                className="bg-danger text-accent-foreground hover:bg-danger/90"
              >
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

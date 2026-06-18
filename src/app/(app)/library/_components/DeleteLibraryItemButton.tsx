"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
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
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => void handleOpenChange(true)}
        aria-label={`Delete ${KIND_LABEL[kind]}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={(next) => void handleOpenChange(next)}>
        <DialogContent>
          <DialogHeader>
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

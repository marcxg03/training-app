"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { CardioActivityEditSheet } from "@/app/(app)/library/_components/CardioActivityEditSheet";

type AddCardioActivityButtonProps = {
  blockId: string;
};

export function AddCardioActivityButton({
  blockId,
}: AddCardioActivityButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 text-[13px] font-bold uppercase tracking-[0.08em] text-accent-foreground transition-colors hover:bg-accent/90"
      >
        <Plus className="h-[18px] w-[18px]" />
        Add Cardio
      </button>
      <CardioActivityEditSheet
        open={open}
        onOpenChange={setOpen}
        mode="create"
        cardioBlockId={blockId}
      />
    </>
  );
}

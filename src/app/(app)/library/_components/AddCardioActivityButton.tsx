"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
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
      <Button type="button" onClick={() => setOpen(true)}>
        Add cardio activity
      </Button>
      <CardioActivityEditSheet
        open={open}
        onOpenChange={setOpen}
        mode="create"
        cardioBlockId={blockId}
      />
    </>
  );
}

"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { RecoveryActivityEditSheet } from "@/app/(app)/library/_components/RecoveryActivityEditSheet";

type AddRecoveryActivityButtonProps = {
  blockId: string;
};

export function AddRecoveryActivityButton({
  blockId,
}: AddRecoveryActivityButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Add recovery activity
      </Button>
      <RecoveryActivityEditSheet
        open={open}
        onOpenChange={setOpen}
        mode="create"
        recoveryBlockId={blockId}
      />
    </>
  );
}

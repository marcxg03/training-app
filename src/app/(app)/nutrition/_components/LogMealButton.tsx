"use client";

import { useState } from "react";

import { LogMealSheet } from "@/app/(app)/nutrition/_components/LogMealSheet";
import { Button } from "@/components/ui/button";

export function LogMealButton({
  userId,
  date,
}: {
  userId: string;
  date: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Log meal</Button>
      <LogMealSheet
        open={open}
        onOpenChange={setOpen}
        userId={userId}
        date={date}
      />
    </>
  );
}

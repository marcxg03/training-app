"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ExerciseEditSheet } from "@/app/(app)/library/_components/ExerciseEditSheet";

export function AddExerciseButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Add exercise
      </Button>
      <ExerciseEditSheet open={open} onOpenChange={setOpen} mode="create" />
    </>
  );
}

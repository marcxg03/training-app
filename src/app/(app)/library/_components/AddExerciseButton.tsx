"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { ExerciseEditSheet } from "@/app/(app)/library/_components/ExerciseEditSheet";

export function AddExerciseButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 text-[13px] font-bold uppercase tracking-[0.08em] text-black transition-colors hover:bg-accent/90"
      >
        <Plus className="h-[18px] w-[18px]" />
        Add Exercise
      </button>
      <ExerciseEditSheet open={open} onOpenChange={setOpen} mode="create" />
    </>
  );
}

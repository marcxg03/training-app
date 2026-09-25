"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { CardioActivityEditSheet } from "@/app/(owner)/library/_components/CardioActivityEditSheet";
import { ExerciseEditSheet } from "@/app/(owner)/library/_components/ExerciseEditSheet";
import { RecoveryActivityEditSheet } from "@/app/(owner)/library/_components/RecoveryActivityEditSheet";
import type {
  CardioActivity,
  ExerciseListItem,
  RecoveryActivity,
} from "@/lib/library/projections";

type EditPencilButtonProps =
  | {
      kind: "exercise";
      exercise: ExerciseListItem;
    }
  | {
      kind: "cardio";
      activity: CardioActivity;
    }
  | {
      kind: "recovery";
      activity: RecoveryActivity;
    };

export function EditPencilButton(props: EditPencilButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Edit"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-faint transition-colors hover:bg-input hover:text-subtle"
      >
        <Pencil className="h-[18px] w-[18px]" />
      </button>

      {props.kind === "exercise" ? (
        <ExerciseEditSheet
          open={open}
          onOpenChange={setOpen}
          mode="edit"
          exercise={props.exercise}
        />
      ) : null}

      {props.kind === "cardio" ? (
        <CardioActivityEditSheet
          open={open}
          onOpenChange={setOpen}
          mode="edit"
          activity={props.activity}
        />
      ) : null}

      {props.kind === "recovery" ? (
        <RecoveryActivityEditSheet
          open={open}
          onOpenChange={setOpen}
          mode="edit"
          activity={props.activity}
        />
      ) : null}
    </>
  );
}

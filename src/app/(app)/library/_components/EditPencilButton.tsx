"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { CardioActivityEditSheet } from "@/app/(app)/library/_components/CardioActivityEditSheet";
import { ExerciseEditSheet } from "@/app/(app)/library/_components/ExerciseEditSheet";
import { RecoveryActivityEditSheet } from "@/app/(app)/library/_components/RecoveryActivityEditSheet";
import { Button } from "@/components/ui/button";
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
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="Edit"
      >
        <Pencil className="h-4 w-4" />
      </Button>

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

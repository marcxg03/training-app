"use client";

import { Trash2 } from "lucide-react";

import { MoveButton } from "@/app/(app)/library/_components/MoveButton";
import { Button } from "@/components/ui/button";

type BankItemRowProps = {
  name: string;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
};

export function BankItemRow({
  name,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onRemove,
}: BankItemRowProps) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/70 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
      </div>
      <div className="flex items-center gap-2">
        <MoveButton direction="up" disabled={index === 0} onClick={onMoveUp} />
        <MoveButton
          direction="down"
          disabled={index === total - 1}
          onClick={onMoveDown}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onRemove}
          aria-label="Remove exercise"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}

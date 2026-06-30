"use client";

import { Check, Trash2 } from "lucide-react";

import { MoveButton } from "@/app/(app)/library/_components/MoveButton";

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
    <li className="flex items-center gap-3 rounded-xl border border-accent bg-accent/10 px-3.5 py-3">
      <span className="flex h-5 w-5 flex-none items-center justify-center rounded-md bg-accent">
        <Check className="h-3.5 w-3.5 text-black" />
      </span>
      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
        {name}
      </p>
      <div className="flex flex-none items-center gap-2">
        <MoveButton direction="up" disabled={index === 0} onClick={onMoveUp} />
        <MoveButton
          direction="down"
          disabled={index === total - 1}
          onClick={onMoveDown}
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove exercise"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-danger/80 transition-colors hover:bg-danger/10 hover:text-danger"
        >
          <Trash2 className="h-[18px] w-[18px]" />
        </button>
      </div>
    </li>
  );
}

"use client";

import { ArrowDown, ArrowUp } from "lucide-react";

type MoveButtonProps = {
  direction: "up" | "down";
  disabled: boolean;
  onClick: () => void;
};

export function MoveButton({ direction, disabled, onClick }: MoveButtonProps) {
  const Icon = direction === "up" ? ArrowUp : ArrowDown;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={direction === "up" ? "Move up" : "Move down"}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-faint transition-colors hover:bg-input hover:text-subtle disabled:pointer-events-none disabled:opacity-30"
    >
      <Icon className="h-[18px] w-[18px]" />
    </button>
  );
}

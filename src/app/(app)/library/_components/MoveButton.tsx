"use client";

import { ArrowDown, ArrowUp } from "lucide-react";

import { Button } from "@/components/ui/button";

type MoveButtonProps = {
  direction: "up" | "down";
  disabled: boolean;
  onClick: () => void;
};

export function MoveButton({ direction, disabled, onClick }: MoveButtonProps) {
  const Icon = direction === "up" ? ArrowUp : ArrowDown;

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      disabled={disabled}
      onClick={onClick}
      aria-label={direction === "up" ? "Move up" : "Move down"}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}

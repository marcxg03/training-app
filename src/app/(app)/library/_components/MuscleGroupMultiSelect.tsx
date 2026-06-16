"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import {
  MUSCLE_GROUP_VALUES,
  PRIMARY_MUSCLE_GROUPS,
  SPECIFIC_MUSCLE_GROUPS,
  type MuscleGroup,
} from "@/lib/library/schemas";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils/cn";

type MuscleGroupMultiSelectProps = {
  value: MuscleGroup[];
  onChange: (value: MuscleGroup[]) => void;
  error?: boolean;
};

function sortGroups(groups: MuscleGroup[]): MuscleGroup[] {
  return [...groups].sort(
    (left, right) =>
      MUSCLE_GROUP_VALUES.indexOf(left) - MUSCLE_GROUP_VALUES.indexOf(right),
  );
}

function formatTriggerLabel(value: MuscleGroup[]) {
  if (value.length === 0) {
    return "Pick muscle groups";
  }

  if (value.length === 1) {
    return (
      PRIMARY_MUSCLE_GROUPS.find((group) => group.value === value[0])?.label ??
      SPECIFIC_MUSCLE_GROUPS.find((group) => group.value === value[0])?.label ??
      "1 muscle group"
    );
  }

  return `${value.length} muscle groups`;
}

export function MuscleGroupMultiSelect({
  value,
  onChange,
  error = false,
}: MuscleGroupMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => new Set(value), [value]);

  const toggle = (group: MuscleGroup) => {
    if (selected.has(group)) {
      onChange(value.filter((entry) => entry !== group));
      return;
    }

    onChange(sortGroups([...value, group]));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-between text-left font-normal",
            error ? "border-danger" : undefined,
          )}
        >
          <span>{formatTriggerLabel(value)}</span>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search muscle groups..." />
          <CommandList>
            <CommandEmpty>No muscle groups found.</CommandEmpty>
            <CommandGroup heading="Primary">
              {PRIMARY_MUSCLE_GROUPS.map((group) => (
                <CommandItem
                  key={group.value}
                  onSelect={() => toggle(group.value)}
                  className="justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Checkbox checked={selected.has(group.value)} />
                    {group.label}
                  </span>
                  {selected.has(group.value) ? (
                    <Check className="h-4 w-4 text-accent" />
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Specific">
              {SPECIFIC_MUSCLE_GROUPS.map((group) => (
                <CommandItem
                  key={group.value}
                  onSelect={() => toggle(group.value)}
                  className="justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Checkbox checked={selected.has(group.value)} />
                    {group.label}
                  </span>
                  {selected.has(group.value) ? (
                    <Check className="h-4 w-4 text-accent" />
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

import { cn } from "@/lib/utils/cn";

type ClientAvatarProps = {
  initials: string;
  size?: "sm" | "md" | "lg";
};

const sizeClass: Record<NonNullable<ClientAvatarProps["size"]>, string> = {
  sm: "h-9 w-9 rounded-[10px] text-xs",
  md: "h-10 w-10 rounded-[11px] text-[13px]",
  lg: "h-[54px] w-[54px] rounded-[15px] text-lg",
};

/** Monogram avatar tile reused across roster, detail, and review screens. */
export function ClientAvatar({ initials, size = "md" }: ClientAvatarProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex flex-none items-center justify-center bg-card-alt font-semibold text-subtle",
        sizeClass[size],
      )}
    >
      {initials}
    </span>
  );
}

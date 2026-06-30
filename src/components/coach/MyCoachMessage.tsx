"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

import { addClientNote } from "@/lib/coach/actions";
import { cn } from "@/lib/utils/cn";

/** Message composer on the client's My Coach screen. Posts a client-authored
 * note to the coach via the coaching mutation contract. */
export function MyCoachMessage() {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canSend = draft.trim().length > 0 && !pending;

  const handleSend = () => {
    const body = draft.trim();
    if (!body) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await addClientNote(body);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDraft("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2.5">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleSend();
            }
          }}
          placeholder="Message your coach…"
          aria-label="Message your coach"
          className="flex-1 rounded-[13px] border border-border bg-input px-3.5 py-3 text-[13px] text-foreground placeholder:text-faint focus-visible:border-accent focus-visible:outline-none"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send message"
          className={cn(
            "flex h-11 w-11 flex-none items-center justify-center rounded-[13px] bg-accent text-black transition-opacity",
            canSend ? "hover:bg-accent/90" : "opacity-50",
          )}
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
      {error ? (
        <p className="text-[11px] font-medium text-warning">{error}</p>
      ) : null}
    </div>
  );
}

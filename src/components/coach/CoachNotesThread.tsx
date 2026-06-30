"use client";

import { useState } from "react";
import { Send } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import type { CoachNote } from "@/lib/coach/types";

type CoachNotesThreadProps = {
  clientId: string;
  initialNotes: CoachNote[];
};

/** Coach notes thread (Frame 45). Adding a note appends to local state only —
 * nothing is persisted (no backend yet). */
export function CoachNotesThread({
  clientId,
  initialNotes,
}: CoachNotesThreadProps) {
  const [notes, setNotes] = useState<CoachNote[]>(initialNotes);
  const [draft, setDraft] = useState("");

  const handleSend = () => {
    const body = draft.trim();
    if (body.length === 0) {
      return;
    }

    const newNote: CoachNote = {
      id: `local-${Date.now()}`,
      clientId,
      body,
      createdAtLabel: "Just now",
      clientVisible: true,
    };

    setNotes((current) => [...current, newNote]);
    setDraft("");
  };

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex-1 space-y-3">
        {notes.map((note) =>
          note.fromClient ? (
            <div
              key={note.id}
              className="max-w-[78%] rounded-[14px] border border-border bg-card-alt px-3.5 py-3"
            >
              <p className="text-[13px] leading-relaxed text-subtle">
                {note.body}
              </p>
              <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.08em] text-faint">
                {note.createdAtLabel}
              </p>
            </div>
          ) : (
            <div
              key={note.id}
              className="rounded-[14px] border border-l-[3px] border-border border-l-accent bg-card px-3.5 py-3.5"
            >
              <p className="text-sm leading-relaxed text-foreground">
                {note.body}
              </p>
              <p className="mt-2.5 font-mono text-[9px] uppercase tracking-[0.08em] text-faint">
                {note.createdAtLabel}
              </p>
            </div>
          ),
        )}
      </div>

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
          placeholder="Write a note…"
          aria-label="Write a note"
          className="flex-1 rounded-[13px] border border-border bg-input px-3.5 py-3 text-[13px] text-foreground placeholder:text-faint focus-visible:border-accent focus-visible:outline-none"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={draft.trim().length === 0}
          aria-label="Send note"
          className={cn(
            "flex h-11 w-11 flex-none items-center justify-center rounded-[13px] bg-accent text-black transition-opacity",
            draft.trim().length === 0 ? "opacity-50" : "hover:bg-accent/90",
          )}
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

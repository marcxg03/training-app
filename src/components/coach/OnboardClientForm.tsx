"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Link2, Mail, Send, UserPlus } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import type { CoachGoalMode } from "@/lib/coach/types";

const GOAL_MODES: { value: CoachGoalMode; label: string }[] = [
  { value: "cut", label: "Cut" },
  { value: "maintain", label: "Maintain" },
  { value: "lean_bulk", label: "Lean bulk" },
];

const JOIN_LINK = "instrument.app/join/9fx2…";

/** Onboard / invite-a-client form (Frame 40). UI-only: submitting flips to a
 * local success state; nothing is persisted (no backend yet). */
export function OnboardClientForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [goalMode, setGoalMode] = useState<CoachGoalMode | null>(null);
  const [sent, setSent] = useState(false);

  const canSend = email.trim().length > 0;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSend) {
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center px-2 py-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-[18px] border border-success/30 bg-success/10">
          <Check className="h-8 w-8 text-success" />
        </span>
        <h2 className="mt-5 text-[20px] font-semibold tracking-tight text-foreground">
          Invite sent
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-subtle">
          We&apos;ve emailed an invite to{" "}
          <span className="text-foreground">{email}</span>. They&apos;ll appear
          as pending on your roster until they accept.
        </p>
        <Link
          href="/coach"
          className="mt-7 flex w-full items-center justify-center gap-2 rounded-[13px] bg-accent px-4 py-3.5 font-mono text-[13px] font-bold uppercase tracking-[0.08em] text-black transition-colors hover:bg-accent/90"
        >
          Back to roster
        </Link>
      </div>
    );
  }

  return (
    <form id="onboard-form" onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label
          htmlFor="client-name"
          className="eyebrow tracking-[0.16em] text-subtle"
        >
          Client name
        </label>
        <input
          id="client-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Maya Khan"
          className="w-full rounded-xl border border-border bg-input px-3.5 py-3 text-sm text-foreground placeholder:text-faint focus-visible:border-accent focus-visible:outline-none"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="client-email"
          className="eyebrow tracking-[0.16em] text-subtle"
        >
          Invite by email
        </label>
        <div className="flex items-center gap-2.5 rounded-xl border border-border bg-input px-3.5 focus-within:border-accent">
          <Mail className="h-4 w-4 flex-none text-accent" />
          <input
            id="client-email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="maya@example.com"
            className="w-full bg-transparent py-3 text-sm text-foreground placeholder:text-faint focus:outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-faint">
          Or
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3.5">
        <Link2 className="h-[18px] w-[18px] flex-none text-accent" />
        <span className="flex-1 truncate font-mono text-[12px] text-subtle">
          {JOIN_LINK}
        </span>
        <Copy className="h-[18px] w-[18px] flex-none text-subtle" />
      </div>

      <div className="space-y-2">
        <p className="eyebrow tracking-[0.16em] text-subtle">
          Starting goal mode <span className="text-faint">· optional</span>
        </p>
        <p className="text-[11px] leading-relaxed text-subtle">
          Set this now, or let the client fill it in on first login.
        </p>
        <div className="mt-1 flex gap-1.5 rounded-xl border border-border bg-input p-1.5">
          {GOAL_MODES.map((mode) => {
            const isActive = mode.value === goalMode;

            return (
              <button
                key={mode.value}
                type="button"
                onClick={() =>
                  setGoalMode((current) =>
                    current === mode.value ? null : mode.value,
                  )
                }
                className={cn(
                  "flex-1 rounded-lg py-2.5 text-center font-mono text-[10px] uppercase tracking-[0.04em] transition-colors",
                  isActive
                    ? "bg-accent font-bold text-black"
                    : "font-semibold text-subtle hover:text-foreground",
                )}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="submit"
        disabled={!canSend}
        className="flex w-full items-center justify-center gap-2 rounded-[13px] bg-accent px-4 py-4 font-mono text-[13px] font-bold uppercase tracking-[0.08em] text-black transition-colors hover:bg-accent/90 disabled:opacity-50"
      >
        {canSend ? (
          <Send className="h-5 w-5" />
        ) : (
          <UserPlus className="h-5 w-5" />
        )}
        Send invite
      </button>
    </form>
  );
}

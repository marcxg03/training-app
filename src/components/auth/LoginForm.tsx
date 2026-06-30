"use client";

import { useState } from "react";
import { Clock, MailCheck, Zap } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";

type LoginState = "idle" | "sending" | "sent" | "error";

type LoginFormProps = {
  initialError?: string | null;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm({ initialError = null }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<LoginState>(
    initialError ? "error" : "idle",
  );
  const [message, setMessage] = useState<string | null>(initialError);
  const supabase = createClient();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEmail = email.trim();

    if (!emailPattern.test(trimmedEmail)) {
      setStatus("error");
      setMessage("Enter a valid email address.");
      return;
    }

    setStatus("sending");
    setMessage(null);

    const { error } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("idle");
      setMessage(error.message);
      return;
    }

    setStatus("sent");
    setMessage(`Check your email — link sent to ${trimmedEmail}`);
  }

  const isBusy = status === "sending";
  const hasError =
    status === "error" || (status === "idle" && message !== null);

  function handleResend() {
    setStatus("idle");
    setMessage(null);
  }

  if (status === "sent") {
    return (
      <div className="flex flex-col items-center text-center">
        <span className="bg-accent/12 flex h-[60px] w-[60px] items-center justify-center rounded-2xl text-accent">
          <MailCheck className="h-7 w-7" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">
          Check your email
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-subtle">
          We sent a sign-in link to
          <br />
          <span className="font-mono text-foreground">{email.trim()}</span>
        </p>
        <div className="mt-6 flex w-full items-center gap-2.5 rounded-xl border border-warning/30 bg-warning/[0.07] px-3.5 py-3 text-left">
          <Clock className="h-5 w-5 shrink-0 text-warning" />
          <span className="text-xs leading-snug text-warning">
            Links expire after 15 min. Expired? Request a new one.
          </span>
        </div>
        <button
          type="button"
          onClick={handleResend}
          className="mt-3.5 w-full rounded-xl border border-border bg-transparent px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-foreground transition-colors hover:bg-card-alt"
        >
          Resend link
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-black">
          <Zap className="h-5 w-5 fill-current" />
        </span>
        <span className="text-xl font-bold tracking-tight text-foreground">
          Training
        </span>
      </div>

      <h1 className="mt-9 text-3xl font-semibold tracking-tight text-foreground">
        Sign in
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-subtle">
        We&apos;ll email you a secure link — no password to remember.
      </p>

      <form className="mt-7 space-y-3.5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="eyebrow" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setStatus("idle");
              setMessage(null);
            }}
            className="flex h-12 w-full rounded-xl border border-border bg-input px-3.5 py-2 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent md:text-sm"
            placeholder="marcus@example.com"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-xl bg-accent px-4 py-4 text-xs font-bold uppercase tracking-wider text-black transition-colors hover:bg-accent/90 disabled:pointer-events-none disabled:opacity-50"
          disabled={isBusy}
        >
          {isBusy ? "Sending..." : "Send magic link"}
        </button>
        {message ? (
          <p
            className={cn("text-sm", hasError ? "text-danger" : "text-accent")}
          >
            {message}
          </p>
        ) : null}
      </form>
    </div>
  );
}

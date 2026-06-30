"use client";

import { useState } from "react";
import { ArrowLeft, Clock, ShieldCheck, Zap } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";

type LoginState = "idle" | "sending" | "code" | "verifying" | "error";

type LoginFormProps = {
  initialError?: string | null;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Supabase email OTP length is configurable (6–10). Accept the full range so a
// dashboard length change never silently truncates the code and breaks sign-in.
const MIN_CODE_LENGTH = 6;
const MAX_CODE_LENGTH = 10;

export function LoginForm({ initialError = null }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
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
        // Kept so the same-device / desktop magic link still works as a
        // fallback. On an installed PWA the link opens the system browser
        // (separate session storage), so the emailed code below is the
        // reliable path — it keeps the whole flow inside the app.
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setCode("");
    setStatus("code");
    setMessage(null);
  }

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedCode = code.trim();

    if (trimmedCode.length < MIN_CODE_LENGTH) {
      setStatus("error");
      setMessage("Enter the code from your email.");
      return;
    }

    setStatus("verifying");
    setMessage(null);

    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: trimmedCode,
      type: "email",
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    // Full navigation so the freshly-set auth cookies reach the server. The
    // callback upserts the profile (idempotent) and redirects to /today.
    window.location.assign("/auth/callback");
  }

  const isVerifyStep = status === "code" || status === "verifying";
  const isBusy = status === "sending" || status === "verifying";
  // After a verify error we stay on the code step; otherwise an error means the
  // email step.
  const hasError =
    status === "error" || (status === "idle" && message !== null);
  const errorOnCodeStep = status === "error" && code.length > 0;

  function handleStartOver() {
    setStatus("idle");
    setMessage(null);
    setCode("");
  }

  if (isVerifyStep || errorOnCodeStep) {
    return (
      <div>
        <button
          type="button"
          onClick={handleStartOver}
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-subtle transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Use a different email
        </button>

        <div className="mt-6 flex items-center gap-3">
          <span className="bg-accent/12 flex h-10 w-10 items-center justify-center rounded-xl text-accent">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span className="text-xl font-bold tracking-tight text-foreground">
            Enter your code
          </span>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-subtle">
          We emailed a sign-in code to
          <br />
          <span className="font-mono text-foreground">{email.trim()}</span>
        </p>

        <form className="mt-6 space-y-3.5" onSubmit={handleVerify}>
          <div className="space-y-2">
            <label className="eyebrow" htmlFor="code">
              Verification code
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={MAX_CODE_LENGTH}
              value={code}
              autoFocus
              onChange={(event) => {
                setCode(
                  event.target.value
                    .replace(/\D/g, "")
                    .slice(0, MAX_CODE_LENGTH),
                );
                if (status === "error") {
                  setStatus("code");
                  setMessage(null);
                }
              }}
              className="flex h-12 w-full rounded-xl border border-border bg-input px-3.5 py-2 text-center font-mono text-lg tracking-[0.4em] text-foreground outline-none transition-colors placeholder:tracking-normal placeholder:text-muted-foreground focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent"
              placeholder="000000"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-accent px-4 py-4 text-xs font-bold uppercase tracking-wider text-black transition-colors hover:bg-accent/90 disabled:pointer-events-none disabled:opacity-50"
            disabled={isBusy || code.trim().length < MIN_CODE_LENGTH}
          >
            {status === "verifying" ? "Verifying..." : "Verify & sign in"}
          </button>
          {message ? <p className="text-sm text-danger">{message}</p> : null}
        </form>

        <div className="mt-6 flex items-center gap-2.5 rounded-xl border border-warning/30 bg-warning/[0.07] px-3.5 py-3">
          <Clock className="h-5 w-5 shrink-0 text-warning" />
          <span className="text-xs leading-snug text-warning">
            Codes expire after a few minutes. On this device you can also tap
            the link in the email.
          </span>
        </div>
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
        We&apos;ll email you a sign-in code — no password to remember.
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
          {isBusy ? "Sending..." : "Send code"}
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

"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
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

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (status !== "sent") {
              setStatus("idle");
              setMessage(null);
            }
          }}
          className="flex h-12 w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-accent"
          placeholder="marcus@example.com"
        />
      </div>
      <Button
        type="submit"
        className="w-full bg-accent text-black hover:bg-accent/90"
        disabled={isBusy}
      >
        {isBusy ? "Sending..." : "Send magic link"}
      </Button>
      {message ? (
        <p className={cn("text-sm", hasError ? "text-danger" : "text-accent")}>
          {message}
        </p>
      ) : null}
    </form>
  );
}

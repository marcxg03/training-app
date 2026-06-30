"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import { signOut } from "@/lib/auth/signOut";

type SignOutButtonProps = {
  userId: string;
};

export function SignOutButton({ userId }: SignOutButtonProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  async function handleSignOut() {
    setIsPending(true);
    setErrorMessage(null);

    try {
      const result = await signOut(userId);

      if (result.aborted) {
        setIsPending(false);
        return;
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Sign out failed.",
      );
      setIsPending(false);
      return;
    }

    router.push("/login");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleSignOut}
        disabled={isPending}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-transparent px-4 py-3.5 text-sm font-semibold tracking-wide text-danger transition-colors hover:border-danger/40 hover:bg-danger/5 disabled:pointer-events-none disabled:opacity-50"
      >
        <LogOut className="h-4 w-4" />
        {isPending ? "Signing out..." : "Sign out"}
      </button>
      {errorMessage ? (
        <p className="text-sm text-danger">{errorMessage}</p>
      ) : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
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
      <Button
        type="button"
        variant="outline"
        onClick={handleSignOut}
        disabled={isPending}
      >
        {isPending ? "Signing out..." : "Sign out"}
      </Button>
      {errorMessage ? (
        <p className="text-sm text-danger">{errorMessage}</p>
      ) : null}
    </div>
  );
}

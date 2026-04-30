import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/LoginForm";
import { createClient } from "@/lib/supabase/server";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getErrorMessage(errorParam: string | string[] | undefined) {
  if (Array.isArray(errorParam)) {
    return getErrorMessage(errorParam[0]);
  }

  if (errorParam === "link_expired") {
    return "That magic link is invalid or has expired. Request a new one.";
  }

  if (errorParam === "auth") {
    return "Could not sign you in. Please try again.";
  }

  return null;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/today");
  }

  const resolvedSearchParams = await searchParams;
  const errorMessage = getErrorMessage(resolvedSearchParams.error);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Login</h1>
          <p className="text-sm text-muted-foreground">
            Sign in with a magic link.
          </p>
        </div>
        <div className="mt-6">
          <LoginForm initialError={errorMessage} />
        </div>
      </div>
    </main>
  );
}

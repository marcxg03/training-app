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
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-md">
        <LoginForm initialError={errorMessage} />
      </div>
    </main>
  );
}

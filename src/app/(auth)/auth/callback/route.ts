import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;
  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(
        new URL("/login?error=link_expired", origin),
      );
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL(code ? "/login?error=auth" : "/login", origin),
    );
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      user_id: user.id,
      goal_mode: "maintain",
    },
    {
      onConflict: "user_id",
      ignoreDuplicates: true,
    },
  );

  if (profileError) {
    return NextResponse.redirect(new URL("/login?error=auth", origin));
  }

  return NextResponse.redirect(new URL("/today", origin));
}

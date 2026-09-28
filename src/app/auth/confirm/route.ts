import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const PASSWORD_EMAIL_TYPES = new Set<EmailOtpType>(["invite", "recovery"]);

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const code = request.nextUrl.searchParams.get("code");
  const destination = safeDestination(request.nextUrl.searchParams.get("next"));
  const supabase = await createServerSupabaseClient();

  let error: Error | null = null;
  if (tokenHash && type && PASSWORD_EMAIL_TYPES.has(type)) {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  } else if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else {
    error = new Error("Missing authentication token.");
  }

  if (!error) {
    return NextResponse.redirect(new URL(destination, request.url));
  }

  return NextResponse.redirect(new URL("/login?error=invalid_link", request.url));
}

function safeDestination(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/set-password";
}

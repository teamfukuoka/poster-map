import { type NextRequest, NextResponse } from "next/server";
import { readAppOrigin, safeAdminPath } from "@/features/admin/auth-redirect";
import { createClient } from "@/lib/supabase/server";

/** Google ログインの戻り先。code をセッションに交換し、管理画面へ進める */
export async function GET(request: NextRequest) {
  const origin = readAppOrigin();
  const code = request.nextUrl.searchParams.get("code");
  const next = safeAdminPath(request.nextUrl.searchParams.get("next"));
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    console.error("auth callback exchange failed", error.code ?? error.name);
  }
  return NextResponse.redirect(`${origin}/admin/login?error=1`);
}

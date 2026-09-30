// Derived from action-board (AGPL-3.0). See NOTICE.md. Modified 2026-10.
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import type { Database } from "./database.types";
import { supabaseEnv } from "./env";

/** 期限切れのセッションを更新し、Cookie をレスポンスに載せ直す */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const { url, anonKey } = supabaseEnv();
  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });
  // getClaims() がトークンを検証し、必要なら更新する。createServerClient との間に処理を挟まない。
  await supabase.auth.getClaims();
  return response;
}

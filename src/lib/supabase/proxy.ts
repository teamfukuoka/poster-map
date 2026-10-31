// Derived from action-board (AGPL-3.0). See NOTICE.md. Modified 2026-10.
import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { STAFF_AUTH_COOKIE } from "./cookie-names";
import type { Database } from "./database.types";
import { supabaseEnv } from "./env";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * 期限切れのセッションを更新し、Cookie をレスポンスに載せ直す。
 * ボランティア（既定の Cookie）と管理画面（STAFF_AUTH_COOKIE）の両方を更新する。
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  // 2つのクライアントが書いた Cookie をためておき、レスポンスを作り直すたびに全部載せる
  const written = new Map<string, CookieToSet>();
  let response = NextResponse.next({ request });
  const { url, anonKey } = supabaseEnv();
  const refresh = (cookieName?: string) => {
    const supabase = createServerClient<Database>(url, anonKey, {
      ...(cookieName ? { cookieOptions: { name: cookieName } } : {}),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const cookie of cookiesToSet) {
            request.cookies.set(cookie.name, cookie.value);
            written.set(cookie.name, cookie);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of written.values()) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });
    // getClaims() がトークンを検証し、必要なら更新する。createServerClient との間に処理を挟まない。
    return supabase.auth.getClaims();
  };
  await refresh();
  await refresh(STAFF_AUTH_COOKIE);
  return response;
}

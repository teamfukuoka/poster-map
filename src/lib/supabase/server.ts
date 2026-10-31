// Derived from action-board (AGPL-3.0). See NOTICE.md. Modified 2026-10.
import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { STAFF_AUTH_COOKIE } from "./cookie-names";
import type { Database } from "./database.types";
import { supabaseEnv } from "./env";

async function createCookieClient(cookieName?: string) {
  const cookieStore = await cookies();
  const { url, anonKey } = supabaseEnv();
  return createServerClient<Database>(url, anonKey, {
    ...(cookieName ? { cookieOptions: { name: cookieName } } : {}),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component からは Cookie を書けない。更新は proxy が行う。
        }
      },
    },
  });
}

/** ボランティア・一般の人のセッション（既定の Cookie）。Server Component / Server Action 用 */
export function createClient() {
  return createCookieClient();
}

/** 管理画面のセッション（STAFF_AUTH_COOKIE）。ボランティアの参加とは別に持つ */
export function createStaffClient() {
  return createCookieClient(STAFF_AUTH_COOKIE);
}

"use server";
// 認可は DB（admin_members と RPC）で行う。ここはログインの入口だけ。
import { redirect } from "next/navigation";
import { FALLBACK_MESSAGE } from "@/features/poster-map/errors";
import type { ActionResult } from "@/features/poster-map/types";
import { createClient } from "@/lib/supabase/server";
import { readAppOrigin } from "./auth-redirect";

function isString(value: unknown): value is string {
  return typeof value === "string";
}

/** Google の認可画面の URL を返す。ブラウザはその URL へ移動し、/auth/callback に戻ってくる */
export async function startGoogleLoginAction(): Promise<ActionResult<{ url: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${readAppOrigin()}/auth/callback?next=/admin`,
      skipBrowserRedirect: true,
    },
  });
  if (error || !data.url) {
    console.error("google login start failed", error?.code ?? error?.name ?? "no_url");
    return { ok: false, error: FALLBACK_MESSAGE };
  }
  return { ok: true, data: { url: data.url } };
}

/** ローカル専用。ADMIN_PASSWORD_LOGIN が "local" でなければ何もしない（本番には設定しない） */
export async function passwordLoginAction(
  email: string,
  password: string,
): Promise<ActionResult<null>> {
  if (process.env.ADMIN_PASSWORD_LOGIN !== "local") return { ok: false, error: FALLBACK_MESSAGE };
  if (!isString(email) || !isString(password)) return { ok: false, error: FALLBACK_MESSAGE };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: "メールアドレスかパスワードが違います。" };
  return { ok: true, data: null };
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  // 通信の失敗などで Supabase 側の失効に失敗しても、この端末の Cookie は必ず消す
  if (error) await supabase.auth.signOut({ scope: "local" });
  redirect("/admin/login");
}

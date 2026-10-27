import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getAdminRole } from "./admin-service";

/**
 * 管理画面の layout とページで共有する（cache で 1 リクエストに 1 回だけ問い合わせる）。
 * getClaims は JWT をローカルで検証するだけで Auth サーバーに問い合わせない。消されたユーザーや
 * 一覧から外した人は admin_whoami（DB が auth.users と一覧を引く）が null を返すので弾ける。
 * 守りの本体は DB（各 RPC が役割を確かめる）で、ここは画面の出し分けに使う。
 */
export const getStaffSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims.sub) return { supabase, signedIn: false as const, role: null };
  return { supabase, signedIn: true as const, role: await getAdminRole(supabase) };
});

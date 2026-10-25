import "server-only";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

/** DB が読めないとき・空のときの名前（受理前の名前。受理後の名前は DB が返す） */
export const SITE_NAME_FALLBACK = "福岡市ポスター掲示板マップ";

/** 管理画面の「公開する」「受理前に戻す」が、この tag で取り直させる */
export const SITE_NAME_TAG = "site-name";

class SiteNameError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

// 失敗は throw して、unstable_cache に保存させない（一時的な失敗の名前を30秒残さない）
const readSiteName = unstable_cache(
  async (): Promise<string> => {
    const { data, error } = await createPublicClient().rpc("current_site_name");
    if (error) throw new SiteNameError(error.code || "unknown");
    if (typeof data !== "string" || !data.trim()) throw new SiteNameError("empty");
    return data;
  },
  ["site-name"],
  { revalidate: 30, tags: [SITE_NAME_TAG] },
);

/** 公開の画面のヘッダー・タイトルに出すサイト名。受理の状態は DB（current_site_name）が決める */
export async function getSiteName(): Promise<string> {
  try {
    return await readSiteName();
  } catch (error) {
    // 接続先や値が入らないよう、エラーの code だけを出す
    console.error(
      "site-name: 取得に失敗",
      error instanceof SiteNameError ? error.code : "unexpected",
    );
    return SITE_NAME_FALLBACK;
  }
}

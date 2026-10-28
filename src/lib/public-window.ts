import "server-only";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

/** 管理画面の「公開を止める」「公開する」などが、この tag で取り直させる */
export const PUBLIC_WINDOW_TAG = "public-window";

class PublicWindowError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

// /api/boards の CDN キャッシュ（30秒）と同じ長さ。失敗は throw して保存させない
const readIsPublicWindow = unstable_cache(
  async (): Promise<boolean> => {
    const { data, error } = await createPublicClient().rpc("is_public_window");
    if (error) throw new PublicWindowError(error.code || "unknown");
    if (typeof data !== "boolean") throw new PublicWindowError("not_boolean");
    return data;
  },
  ["public-window"],
  { revalidate: 30, tags: [PUBLIC_WINDOW_TAG] },
);

/**
 * いま公開期間内か。トップページが、期間外の案内を最初の HTML に入れるために使う。
 * 読めないときは null（画面は今までどおり /api/boards で確かめる）
 */
export async function getIsPublicWindow(): Promise<boolean | null> {
  try {
    return await readIsPublicWindow();
  } catch (error) {
    // 接続先や値が入らないよう、エラーの code だけを出す
    console.error(
      "public-window: 取得に失敗",
      error instanceof PublicWindowError ? error.code : "unexpected",
    );
    return null;
  }
}

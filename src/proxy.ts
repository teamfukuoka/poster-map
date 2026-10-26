// Derived from action-board (AGPL-3.0). See NOTICE.md. Modified 2026-10.
import type { NextRequest } from "next/server";
import { previewBasicAuthResponse } from "@/lib/preview-basic-auth";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // 確認用（Preview）だけベーシック認証。本番とローカルでは null が返り、今までどおり進む
  return previewBasicAuthResponse(request) ?? updateSession(request);
}

export const config = {
  matcher: [
    // 公開 API（CDN キャッシュ）・静的ファイル・画像は対象外。
    // 公開 API の Preview のベーシック認証は route.ts で行う（本番で proxy を通さないため）
    "/((?!api/boards|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

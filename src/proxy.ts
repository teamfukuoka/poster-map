// Derived from action-board (AGPL-3.0). See NOTICE.md. Modified 2026-10.
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // 公開 API（CDN キャッシュ）・静的ファイル・画像は対象外
    "/((?!api/boards|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

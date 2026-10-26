import {
  buildPublicBoardsResponse,
  hasQueryString,
  type PublicApiResult,
  QUERY_REJECTED,
} from "@/features/poster-map/public-api";
import { previewBasicAuthResponse } from "@/lib/preview-basic-auth";
import { createPublicClient } from "@/lib/supabase/public";

// 毎回 DB を読み、キャッシュは Vercel の CDN（s-maxage）に任せる
export const dynamic = "force-dynamic";

function toResponse(result: PublicApiResult): Response {
  // 確認用（Preview）は認証つきなので CDN に載せない
  const cacheControl =
    process.env.VERCEL_ENV === "preview" ? "private, no-store" : result.cacheControl;
  return Response.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": cacheControl },
  });
}

export async function GET(request: Request) {
  const denied = previewBasicAuthResponse(request);
  if (denied) return denied;
  if (hasQueryString(request.url)) return toResponse(QUERY_REJECTED);
  return toResponse(await buildPublicBoardsResponse(createPublicClient()));
}

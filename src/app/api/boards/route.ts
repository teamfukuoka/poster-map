import {
  buildPublicBoardsResponse,
  hasQueryString,
  type PublicApiResult,
  QUERY_REJECTED,
} from "@/features/poster-map/public-api";
import { createPublicClient } from "@/lib/supabase/public";

// 毎回 DB を読み、キャッシュは Vercel の CDN（s-maxage）に任せる
export const dynamic = "force-dynamic";

function toResponse(result: PublicApiResult): Response {
  return Response.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": result.cacheControl },
  });
}

export async function GET(request: Request) {
  if (hasQueryString(request.url)) return toResponse(QUERY_REJECTED);
  return toResponse(await buildPublicBoardsResponse(createPublicClient()));
}

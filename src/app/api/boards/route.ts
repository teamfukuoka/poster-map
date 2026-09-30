import { buildPublicBoardsResponse } from "@/features/poster-map/public-api";
import { createPublicClient } from "@/lib/supabase/public";

// 毎回 DB を読み、キャッシュは Vercel の CDN（s-maxage）に任せる
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await buildPublicBoardsResponse(createPublicClient());
  return Response.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": result.cacheControl },
  });
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { fetchAllBoards } from "./boards-query";
import type { MapBoard } from "./types";

export const PUBLIC_CACHE_CONTROL = "public, max-age=0, s-maxage=30, stale-while-revalidate=30";
export const CLOSED_CACHE_CONTROL = "public, max-age=0, s-maxage=30";
export const NO_STORE = "no-store";

export type PublicApiResult = {
  status: 200 | 404 | 500;
  cacheControl: string;
  body: { boards: MapBoard[] } | { error: "closed" | "unavailable" };
};

/** /api/boards の中身。匿名クライアントで読むので、公開期間外は RLS でも空になる */
export async function buildPublicBoardsResponse(
  client: SupabaseClient<Database>,
): Promise<PublicApiResult> {
  const { data: isOpen, error } = await client.rpc("is_public_window");
  if (error) {
    console.error("is_public_window failed", error.message);
    return { status: 500, cacheControl: NO_STORE, body: { error: "unavailable" } };
  }
  if (!isOpen) {
    return { status: 404, cacheControl: CLOSED_CACHE_CONTROL, body: { error: "closed" } };
  }
  try {
    const boards = await fetchAllBoards(client);
    return { status: 200, cacheControl: PUBLIC_CACHE_CONTROL, body: { boards } };
  } catch (e) {
    console.error("fetchAllBoards failed", e);
    return { status: 500, cacheControl: NO_STORE, body: { error: "unavailable" } };
  }
}

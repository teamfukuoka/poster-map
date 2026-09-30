import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { MapBoard } from "./types";

export const BOARD_COLUMNS = "id,number,name,address,ward,lat,long,status" as const;

/** Supabase の 1 回の取得上限（max_rows = 1000）を超える件数を、ページを分けて取る */
export async function fetchAllPages<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export async function fetchAllBoards(client: SupabaseClient<Database>): Promise<MapBoard[]> {
  return fetchAllPages<MapBoard>((from, to) =>
    client.from("poster_boards").select(BOARD_COLUMNS).order("number").range(from, to),
  );
}

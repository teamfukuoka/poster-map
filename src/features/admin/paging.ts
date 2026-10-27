// Supabase の 1 回の取得は max_rows（supabase/config.toml、1000）で切れる。
// RPC の order by は一意なキーなので、range でページを分けても順番は決まっている。

/** Supabase の 1 回の取得上限（max_rows = 1000） */
export const PAGE_SIZE = 1000;

type PageError = { code?: string | null; message?: string | null };
export type PageResult<T> = { data: T[] | null; error: PageError | null };

/**
 * 全部のページを取って 1 つの配列にする。どのページでも error があれば、そこで止めて error を返す
 * （エラー値はそのまま返すので、呼び出し側が not_admin などの文言に変えられる）
 */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = PAGE_SIZE,
): Promise<{ data: T[]; error: null } | { data: null; error: PageError }> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) return { data: null, error };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return { data: rows, error: null };
  }
}

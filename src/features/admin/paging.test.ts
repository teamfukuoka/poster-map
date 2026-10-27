import { fetchAllRows, type PageResult } from "./paging";

/** rows から from〜to を返す、range の代わり */
function source(rows: number[]) {
  const calls: [number, number][] = [];
  const fetchPage = async (from: number, to: number): Promise<PageResult<number>> => {
    calls.push([from, to]);
    return { data: rows.slice(from, to + 1), error: null };
  };
  return { calls, fetchPage };
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

test("1 ページに収まれば 1 回で終わる", async () => {
  const { calls, fetchPage } = source(range(3));
  expect(await fetchAllRows(fetchPage, 5)).toEqual({ data: [0, 1, 2], error: null });
  expect(calls).toEqual([[0, 4]]);
});

test("ページをまたいでも順番どおり全部取る", async () => {
  const { calls, fetchPage } = source(range(12));
  const result = await fetchAllRows(fetchPage, 5);
  expect(result).toEqual({ data: range(12), error: null });
  expect(calls).toEqual([
    [0, 4],
    [5, 9],
    [10, 14],
  ]);
});

test("ちょうどページの大きさなら、空のページまで確かめる", async () => {
  const { calls, fetchPage } = source(range(10));
  expect(await fetchAllRows(fetchPage, 5)).toEqual({ data: range(10), error: null });
  expect(calls).toHaveLength(3);
});

test("0 件でも空の配列を返す", async () => {
  const { fetchPage } = source([]);
  expect(await fetchAllRows(fetchPage, 5)).toEqual({ data: [], error: null });
});

test("data が null のページは空として扱う", async () => {
  expect(await fetchAllRows(async () => ({ data: null, error: null }), 5)).toEqual({
    data: [],
    error: null,
  });
});

test("途中のページでエラーなら、取れた分は捨てて error を返す（コードも残る）", async () => {
  const rows = range(12);
  const fetchPage = async (from: number, to: number): Promise<PageResult<number>> =>
    from === 5
      ? { data: null, error: { code: "P0001", message: "not_admin" } }
      : { data: rows.slice(from, to + 1), error: null };
  expect(await fetchAllRows(fetchPage, 5)).toEqual({
    data: null,
    error: { code: "P0001", message: "not_admin" },
  });
});

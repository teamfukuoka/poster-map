import { fetchAllPages } from "./boards-query";

test("ページが埋まっている間は次のページを取りにいく", async () => {
  const all = Array.from({ length: 5 }, (_, i) => i);
  const calls: [number, number][] = [];
  const result = await fetchAllPages(async (from, to) => {
    calls.push([from, to]);
    return { data: all.slice(from, to + 1), error: null };
  }, 2);
  expect(result).toEqual([0, 1, 2, 3, 4]);
  expect(calls).toEqual([
    [0, 1],
    [2, 3],
    [4, 5],
  ]);
});

test("ちょうど割り切れるときは空のページで止まる", async () => {
  const all = [0, 1, 2, 3];
  const result = await fetchAllPages(
    async (from, to) => ({ data: all.slice(from, to + 1), error: null }),
    2,
  );
  expect(result).toEqual([0, 1, 2, 3]);
});

test("エラーなら例外にする", async () => {
  await expect(
    fetchAllPages(async () => ({ data: null, error: { message: "boom" } }), 2),
  ).rejects.toThrow("boom");
});

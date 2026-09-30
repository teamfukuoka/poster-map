import { countByStatus, emptyStatusCounts, summarize, summarizeByWard } from "./stats";

test("emptyStatusCounts は全ステータスが0", () => {
  expect(Object.values(emptyStatusCounts())).toEqual([0, 0, 0, 0, 0, 0]);
});

test("countByStatus はステータスごとに数える", () => {
  const counts = countByStatus([{ status: "done" }, { status: "done" }, { status: "reserved" }]);
  expect(counts.done).toBe(2);
  expect(counts.reserved).toBe(1);
  expect(counts.not_yet).toBe(0);
});

test("summarize は完了率を小数第1位まで出す", () => {
  const boards = [
    { status: "done" as const },
    { status: "not_yet" as const },
    { status: "not_yet" as const },
  ];
  expect(summarize(boards)).toMatchObject({ total: 3, donePercent: 33.3 });
});

test("0件のときの完了率は0", () => {
  expect(summarize([]).donePercent).toBe(0);
});

test("summarizeByWard は区の公式順に並べ、掲示板のない区は出さない", () => {
  const result = summarizeByWard([
    { ward: "西区", status: "done" },
    { ward: "東区", status: "not_yet" },
    { ward: "東区", status: "done" },
  ]);
  expect(result.map((r) => r.ward)).toEqual(["東区", "西区"]);
  expect(result[0].summary).toMatchObject({ total: 2, donePercent: 50 });
});

test("区の一覧にない区は最後に出す", () => {
  const result = summarizeByWard([
    { ward: "不明区", status: "done" },
    { ward: "中央区", status: "done" },
  ]);
  expect(result.map((r) => r.ward)).toEqual(["中央区", "不明区"]);
});

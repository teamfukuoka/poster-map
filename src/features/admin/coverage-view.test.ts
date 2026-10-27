import {
  boardsInRow,
  buildPlaces,
  chomeRowsOf,
  filterAssignees,
  filterSummary,
  formatShare,
  hasSameLabel,
  isRehearsalNotePeriod,
  parseRanges,
  rangeKey,
  rangeLabel,
  searchPlaces,
  totalsOf,
} from "./coverage-view";
import type {
  CoverageAssignee,
  CoverageBoard,
  CoverageKind,
  CoverageRange,
  CoverageSummaryRow,
} from "./types";

const range = (r: Partial<CoverageRange> & { kind: CoverageKind }): CoverageRange => ({
  ward: null,
  school: null,
  town: null,
  chome: null,
  ...r,
});

const row = (r: Partial<CoverageSummaryRow> & { unit: CoverageKind }): CoverageSummaryRow => ({
  ward: null,
  school: null,
  town: null,
  chome: null,
  total: 0,
  assigned: 0,
  reserved: 0,
  none: 0,
  assignee_labels: [],
  ...r,
});

const assignee = (id: string, label: string, ranges: CoverageRange[]): CoverageAssignee => ({
  id,
  label,
  note: "",
  updated_at: "2026-10-28T00:00:00.123456+00:00",
  ranges,
  board_count: 0,
});

describe("rangeLabel", () => {
  test("4 種類", () => {
    expect(rangeLabel(range({ kind: "ward", ward: "東区" }))).toBe("東区");
    expect(rangeLabel(range({ kind: "school", school: "馬出小" }))).toBe("馬出小（校区）");
    expect(rangeLabel(range({ kind: "town", ward: "東区", town: "馬出" }))).toBe("東区 馬出");
    expect(rangeLabel(range({ kind: "chome", ward: "東区", town: "馬出", chome: "3丁目" }))).toBe(
      "東区 馬出 3丁目",
    );
  });
});

describe("parseRanges", () => {
  test("正しい配列はそのまま", () => {
    const ok = [
      range({ kind: "ward", ward: "東区" }),
      range({ kind: "town", ward: "東区", town: "馬出" }),
    ];
    expect(parseRanges(ok)).toEqual(ok);
  });
  test("形が違えば null", () => {
    expect(parseRanges("x")).toBeNull();
    expect(parseRanges({ kind: "ward" })).toBeNull();
    expect(parseRanges([null])).toBeNull();
    expect(parseRanges([{ ...range({ kind: "ward", ward: "東区" }), kind: "city" }])).toBeNull();
    expect(parseRanges([{ ...range({ kind: "ward", ward: "東区" }), ward: 1 }])).toBeNull();
    expect(parseRanges([{ ...range({ kind: "ward", ward: "東区" }), town: {} }])).toBeNull();
  });
});

describe("buildPlaces と searchPlaces", () => {
  const summary: CoverageSummaryRow[] = [
    row({ unit: "ward", ward: "東区", total: 100 }),
    row({ unit: "school", ward: "南区", school: "宮竹小", total: 3 }),
    row({ unit: "school", ward: "博多区", school: "宮竹小", total: 2 }),
    row({ unit: "school", ward: "東区", school: null, total: 7 }),
    row({ unit: "town", ward: "東区", town: "馬出", total: 10 }),
    row({ unit: "chome", ward: "東区", town: "馬出", chome: "10丁目", total: 1 }),
    row({ unit: "chome", ward: "東区", town: "馬出", chome: "1丁目", total: 4 }),
  ];

  test("校区は区をまたいで 1 つにまとめる", () => {
    const miyatake = buildPlaces(summary).filter((p) => p.kind === "school");
    expect(miyatake).toEqual([
      {
        kind: "school",
        range: range({ kind: "school", school: "宮竹小" }),
        label: "宮竹小（校区）",
        wards: ["博多区", "南区"],
        boardCount: 5,
      },
    ]);
  });

  test("検索は前後の空白を取り、kind の順、次に label の順", () => {
    const places = buildPlaces(summary);
    expect(searchPlaces(places, " 馬出 ").map((p) => p.label)).toEqual([
      "東区 馬出",
      "東区 馬出 1丁目",
      "東区 馬出 10丁目",
    ]);
    expect(searchPlaces(places, "")).toEqual([]);
    expect(searchPlaces(places, "   ")).toEqual([]);
    expect(searchPlaces(places, "区", 2)).toHaveLength(2);
  });
});

describe("filterSummary など", () => {
  const rows: CoverageSummaryRow[] = [
    row({ unit: "ward", ward: "南区", total: 10, assigned: 5, reserved: 2, none: 3 }),
    row({ unit: "ward", ward: "東区", total: 20, assigned: 20 }),
    row({ unit: "town", ward: "南区", town: "B", total: 4, none: 1 }),
    row({ unit: "town", ward: "東区", town: "A", total: 4, none: 1 }),
    row({ unit: "town", ward: "東区", town: "C", total: 4, none: 5 }),
    row({ unit: "town", ward: "東区", town: "D", total: 4, none: 0 }),
    row({ unit: "chome", ward: "東区", town: "C", chome: "2丁目", total: 1 }),
    row({ unit: "chome", ward: "東区", town: "C", chome: "10丁目", total: 1 }),
    row({ unit: "chome", ward: "東区", town: "C", chome: "1丁目", total: 1 }),
  ];

  test("onlyGaps で none=0 が消え、none の多い順・同じなら区の順・地名の順", () => {
    const out = filterSummary(rows, { unit: "town", ward: null, onlyGaps: true });
    expect(out.map((r) => r.town)).toEqual(["C", "A", "B"]);
  });
  test("town の unit は丁目の行を含まない・区で絞れる", () => {
    const out = filterSummary(rows, { unit: "town", ward: "東区", onlyGaps: false });
    expect(out.map((r) => r.town)).toEqual(["C", "A", "D"]);
  });
  test("chomeRowsOf は丁目の数の順", () => {
    expect(chomeRowsOf(rows, "東区", "C").map((r) => r.chome)).toEqual([
      "1丁目",
      "2丁目",
      "10丁目",
    ]);
  });
  test("totalsOf は区の行を足す", () => {
    expect(totalsOf(rows)).toEqual({ total: 30, assigned: 25, reserved: 2, none: 3 });
  });
});

describe("boardsInRow", () => {
  const board = (b: Partial<CoverageBoard>): CoverageBoard =>
    ({
      board_id: "x",
      number: "1",
      name: "",
      address: "",
      ward: "東区",
      lat: 0,
      long: 0,
      status: "not_yet",
      school: null,
      school_source: null,
      town: null,
      chome: null,
      coverage: "none",
      assignee_labels: [],
      ...b,
    }) as CoverageBoard;
  const boards = [
    board({ number: "1", ward: "東区", school: "馬出小", town: "馬出", chome: "1丁目" }),
    board({ number: "2", ward: "東区", school: "馬出小", town: "馬出", chome: "2丁目" }),
    board({ number: "3", ward: "南区", school: "馬出小", town: "馬出", chome: "1丁目" }),
    board({ number: "4", ward: "東区" }),
  ];
  test("単位ごとに当たる掲示場を返す", () => {
    const pick = (r: CoverageSummaryRow) => boardsInRow(boards, r).map((b) => b.number);
    expect(pick(row({ unit: "ward", ward: "東区" }))).toEqual(["1", "2", "4"]);
    expect(pick(row({ unit: "school", ward: "東区", school: "馬出小" }))).toEqual(["1", "2"]);
    expect(pick(row({ unit: "town", ward: "東区", town: "馬出" }))).toEqual(["1", "2"]);
    expect(pick(row({ unit: "chome", ward: "東区", town: "馬出", chome: "1丁目" }))).toEqual(["1"]);
    expect(pick(row({ unit: "school", ward: "東区", school: null }))).toEqual(["4"]);
  });
});

test("rangeKey は範囲ごとに違い、同じ範囲で同じ", () => {
  const a = range({ kind: "town", ward: "東区", town: "馬出" });
  expect(rangeKey(a)).toBe(rangeKey({ ...a }));
  expect(rangeKey(a)).not.toBe(rangeKey(range({ kind: "ward", ward: "東区" })));
});

test("formatShare", () => {
  expect(formatShare(312, 380)).toBe("312（82%）");
  expect(formatShare(0, 0)).toBe("0（—）");
});

test("isRehearsalNotePeriod は 11/1 0:00（日本時間）で終わる", () => {
  expect(isRehearsalNotePeriod(new Date("2026-10-31T23:59:59+09:00"))).toBe(true);
  expect(isRehearsalNotePeriod(new Date("2026-11-01T00:00:00+09:00"))).toBe(false);
});

describe("担当者", () => {
  const list = [
    assignee("a", "田中さん", [range({ kind: "town", ward: "東区", town: "馬出" })]),
    assignee("b", "佐藤さん", [range({ kind: "ward", ward: "南区" })]),
  ];
  test("hasSameLabel は前後の空白を取って比べ、本人は除く", () => {
    expect(hasSameLabel(list, " 田中さん")).toBe(true);
    expect(hasSameLabel(list, "田中さん", "a")).toBe(false);
    expect(hasSameLabel(list, "田中さん", "b")).toBe(true);
    expect(hasSameLabel(list, "鈴木さん")).toBe(false);
  });
  test("filterAssignees は呼び名か範囲の名前", () => {
    expect(filterAssignees(list, "馬出").map((a) => a.id)).toEqual(["a"]);
    expect(filterAssignees(list, "佐藤").map((a) => a.id)).toEqual(["b"]);
    expect(filterAssignees(list, "  ").map((a) => a.id)).toEqual(["a", "b"]);
  });
});

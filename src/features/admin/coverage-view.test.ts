import {
  boardsInRow,
  buildPlaces,
  chomeLabel,
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
  district: null,
  school: null,
  town: null,
  chome: null,
  ...r,
});

const row = (r: Partial<CoverageSummaryRow> & { unit: CoverageKind }): CoverageSummaryRow => ({
  ward: null,
  district: null,
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
  test("5 種類", () => {
    expect(rangeLabel(range({ kind: "ward", ward: "東区" }))).toBe("東区");
    expect(rangeLabel(range({ kind: "district", ward: "東区", district: "馬出第一" }))).toBe(
      "東区 馬出第一（投票区）",
    );
    expect(rangeLabel(range({ kind: "school", school: "馬出小" }))).toBe("馬出小（校区）");
    expect(rangeLabel(range({ kind: "town", ward: "東区", town: "馬出" }))).toBe("東区 馬出");
    expect(rangeLabel(range({ kind: "chome", ward: "東区", town: "馬出", chome: "3" }))).toBe(
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
  test("投票区を読み、district が無い古い形は null として読む", () => {
    const district = range({ kind: "district", ward: "東区", district: "馬出第一" });
    expect(parseRanges([district])).toEqual([district]);
    const { district: _, ...old } = range({ kind: "town", ward: "東区", town: "馬出" });
    expect(parseRanges([old])).toEqual([range({ kind: "town", ward: "東区", town: "馬出" })]);
    expect(parseRanges([{ ...district, district: 1 }])).toBeNull();
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

test("chomeLabel は数字に「丁目」を付ける", () => {
  expect(chomeLabel("3")).toBe("3丁目");
});

describe("buildPlaces と searchPlaces", () => {
  const summary: CoverageSummaryRow[] = [
    row({ unit: "ward", ward: "東区", total: 100 }),
    row({ unit: "district", ward: "東区", district: "馬出第一", total: 6 }),
    row({ unit: "district", ward: "博多区", district: "馬出第一", total: 2 }),
    row({ unit: "school", ward: "南区", school: "宮竹小", total: 3 }),
    row({ unit: "school", ward: "博多区", school: "宮竹小", total: 2 }),
    row({ unit: "school", ward: "東区", school: null, total: 7 }),
    row({ unit: "town", ward: "東区", town: "馬出", total: 10 }),
    row({ unit: "chome", ward: "東区", town: "馬出", chome: "10", total: 1 }),
    row({ unit: "chome", ward: "東区", town: "馬出", chome: "1", total: 4 }),
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

  test("投票区は区ごとに別の場所", () => {
    const districts = buildPlaces(summary).filter((p) => p.kind === "district");
    expect(districts).toEqual([
      {
        kind: "district",
        range: range({ kind: "district", ward: "東区", district: "馬出第一" }),
        label: "東区 馬出第一（投票区）",
        wards: ["東区"],
        boardCount: 6,
      },
      {
        kind: "district",
        range: range({ kind: "district", ward: "博多区", district: "馬出第一" }),
        label: "博多区 馬出第一（投票区）",
        wards: ["博多区"],
        boardCount: 2,
      },
    ]);
  });

  test("検索は前後の空白を取り、kind の順、次に label の順", () => {
    const places = buildPlaces(summary);
    expect(searchPlaces(places, " 東区馬出 ").places.map((p) => p.label)).toEqual([
      "東区 馬出第一（投票区）",
      "東区 馬出",
      "東区 馬出 1丁目",
      "東区 馬出 10丁目",
    ]);
    expect(searchPlaces(places, "")).toEqual({ places: [], more: 0 });
    expect(searchPlaces(places, "   ")).toEqual({ places: [], more: 0 });
  });

  test("検索は空白（半角・全角）を無視する", () => {
    const places = buildPlaces(summary);
    expect(searchPlaces(places, "東区馬出").places.map((p) => p.label)).toContain("東区 馬出");
    expect(searchPlaces(places, "東区　馬 出").places.map((p) => p.label)).toContain("東区 馬出");
  });

  test("丁目の場所は「3丁目」「馬出1丁目」でも見つかる", () => {
    const places = buildPlaces(summary);
    expect(searchPlaces(places, "1丁目").places.map((p) => p.label)).toEqual(["東区 馬出 1丁目"]);
    expect(searchPlaces(places, "馬出1丁目").places.map((p) => p.label)).toEqual([
      "東区 馬出 1丁目",
    ]);
    expect(searchPlaces(places, "馬出 10丁目").places.map((p) => p.label)).toEqual([
      "東区 馬出 10丁目",
    ]);
  });

  test("上限で切ったら、残りの件数を more で返す", () => {
    const places = buildPlaces(summary);
    const result = searchPlaces(places, "区", 2);
    expect(result.places).toHaveLength(2);
    expect(result.more).toBe(5);
    expect(searchPlaces(places, "区", 20).more).toBe(0);
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
    row({ unit: "chome", ward: "東区", town: "C", chome: "2", total: 1 }),
    row({ unit: "chome", ward: "東区", town: "C", chome: "10", total: 1 }),
    row({ unit: "chome", ward: "東区", town: "C", chome: "1", total: 1 }),
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
    expect(chomeRowsOf(rows, "東区", "C").map((r) => r.chome)).toEqual(["1", "2", "10"]);
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
      district: null,
      town: null,
      chome: null,
      coverage: "none",
      assignee_labels: [],
      ...b,
    }) as CoverageBoard;
  const boards = [
    board({
      number: "1",
      ward: "東区",
      district: "馬出第一",
      school: "馬出小",
      town: "馬出",
      chome: "1",
    }),
    board({ number: "2", ward: "東区", school: "馬出小", town: "馬出", chome: "2" }),
    board({
      number: "3",
      ward: "南区",
      district: "馬出第一",
      school: "馬出小",
      town: "馬出",
      chome: "1",
    }),
    board({ number: "4", ward: "東区" }),
  ];
  test("単位ごとに当たる掲示場を返す", () => {
    const pick = (r: CoverageSummaryRow) => boardsInRow(boards, r).map((b) => b.number);
    expect(pick(row({ unit: "ward", ward: "東区" }))).toEqual(["1", "2", "4"]);
    expect(pick(row({ unit: "district", ward: "東区", district: "馬出第一" }))).toEqual(["1"]);
    expect(pick(row({ unit: "school", ward: "東区", school: "馬出小" }))).toEqual(["1", "2"]);
    expect(pick(row({ unit: "town", ward: "東区", town: "馬出" }))).toEqual(["1", "2"]);
    expect(pick(row({ unit: "chome", ward: "東区", town: "馬出", chome: "1" }))).toEqual(["1"]);
    expect(pick(row({ unit: "school", ward: "東区", school: null }))).toEqual(["4"]);
  });
});

test("rangeKey は範囲ごとに違い、同じ範囲で同じ", () => {
  const a = range({ kind: "town", ward: "東区", town: "馬出" });
  expect(rangeKey(a)).toBe(rangeKey({ ...a }));
  expect(rangeKey(a)).not.toBe(rangeKey(range({ kind: "ward", ward: "東区" })));
  expect(rangeKey(range({ kind: "district", ward: "東区", district: "馬出第一" }))).not.toBe(
    rangeKey(range({ kind: "district", ward: "博多区", district: "馬出第一" })),
  );
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

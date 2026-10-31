import {
  DISTRICT_MAX_RESULTS,
  isInDistrict,
  normalizeForSearch,
  SEARCH_MAX_RESULTS,
  searchBoards,
  searchDistricts,
  splitBoardNumber,
} from "./search";

const boards = [
  { number: "別府第１-1", name: "人道橋東側", address: "城南区別府四丁目７番", ward: "城南区" },
  {
    number: "春吉第一-1",
    name: "十八親和銀行ビル駐車場フェンス",
    address: "中央区西中洲6番27号",
    ward: "中央区",
  },
];

test("normalizeForSearch は全角英数を半角にし、小文字にし、空白を除く", () => {
  expect(normalizeForSearch("別府第１ - 1　ＡＢ")).toBe("別府第1-1ab");
});

test("全角・半角の違いを吸収して番号で探せる", () => {
  expect(searchBoards(boards, "別府第1-1").map((b) => b.number)).toEqual(["別府第１-1"]);
});

test.each([
  "別府第1ー1",
  "別府第1−1",
  "別府第1–1",
  "別府第1ｰ1",
])("ハイフン類の違いを吸収する（%s）", (query) => {
  expect(searchBoards(boards, query).map((b) => b.number)).toEqual(["別府第１-1"]);
});

test("対象側のハイフン類も揃え、長音の「ー」は数字に挟まれたときだけ - とみなす", () => {
  const items = [{ number: "天神1ー2", name: "センター前", address: "中央区天神", ward: "中央区" }];
  expect(searchBoards(items, "天神1-2")).toHaveLength(1);
  expect(searchBoards(items, "センター")).toHaveLength(1);
  expect(normalizeForSearch("センター1ー2")).toBe("センター1-2");
});

test("名称・住所・区でも探せる", () => {
  expect(searchBoards(boards, "親和")).toHaveLength(1);
  expect(searchBoards(boards, "四丁目7")).toHaveLength(1);
  expect(searchBoards(boards, "中央区")).toHaveLength(1);
});

test("1文字では検索しない", () => {
  expect(searchBoards(boards, "別")).toEqual([]);
});

test("最大件数で打ち切る", () => {
  const many = Array.from({ length: 30 }, (_, i) => ({
    number: `A-${i}`,
    name: "掲示板",
    address: "中央区",
    ward: "中央区",
  }));
  expect(searchBoards(many, "掲示板")).toHaveLength(SEARCH_MAX_RESULTS);
});

test("splitBoardNumber は最後の「-数字」の前を投票区にする", () => {
  expect(splitBoardNumber("筥松第二-6")).toEqual({ district: "筥松第二", seq: "6" });
  expect(splitBoardNumber("別府第１-12")).toEqual({ district: "別府第１", seq: "12" });
  expect(splitBoardNumber("番号なし")).toEqual({ district: null, seq: "番号なし" });
});

describe("searchDistricts", () => {
  const items = [
    { number: "馬出第一-1", ward: "東区" },
    { number: "馬出第一-2", ward: "東区" },
    { number: "東馬出-1", ward: "東区" },
    { number: "馬出第二-1", ward: "東区" },
    { number: "別府第１-1", ward: "城南区" },
  ];

  test("投票区ごとに掲示板の数をまとめ、前方一致を先に出す", () => {
    expect(searchDistricts(items, "馬出")).toEqual([
      { district: "馬出第一", ward: "東区", count: 2 },
      { district: "馬出第二", ward: "東区", count: 1 },
      { district: "東馬出", ward: "東区", count: 1 },
    ]);
  });

  test("全角・半角の違いを吸収する", () => {
    expect(searchDistricts(items, "別府第1")).toEqual([
      { district: "別府第１", ward: "城南区", count: 1 },
    ]);
  });

  test("1文字では探さない・最大件数で打ち切る", () => {
    expect(searchDistricts(items, "馬")).toEqual([]);
    const wide = Array.from({ length: 9 }, (_, i) => ({ number: `投票区${i}-1`, ward: "東区" }));
    expect(searchDistricts(wide, "投票区")).toHaveLength(DISTRICT_MAX_RESULTS);
  });
});

test("isInDistrict", () => {
  expect(isInDistrict({ number: "馬出第一-3" }, "馬出第一")).toBe(true);
  expect(isInDistrict({ number: "東馬出-1" }, "馬出")).toBe(false);
});

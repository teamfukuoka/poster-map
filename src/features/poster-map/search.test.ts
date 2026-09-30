import { normalizeForSearch, SEARCH_MAX_RESULTS, searchBoards } from "./search";

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

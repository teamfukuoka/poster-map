import {
  BOARD_STATUSES,
  isBoardStatus,
  PIE_ORDER,
  STATUS_CONFIG,
  STATUS_SELECT_ORDER,
} from "./status";

test("全ステータスに表示設定がある", () => {
  expect(Object.keys(STATUS_CONFIG).sort()).toEqual([...BOARD_STATUSES].sort());
});

test("並び順の配列はどれも全ステータスをちょうど1回ずつ含む", () => {
  for (const order of [STATUS_SELECT_ORDER, PIE_ORDER]) {
    expect([...order].sort()).toEqual([...BOARD_STATUSES].sort());
  }
});

test("他候補のポスターは赤・エラー扱い", () => {
  expect(STATUS_CONFIG.error_wrong_poster).toEqual({
    label: "エラー（他候補のポスターが貼られている）",
    shortLabel: "他候補",
    color: "#EF4444",
    group: "error",
  });
});

test("isBoardStatus は定義済みの値だけを通す", () => {
  expect(isBoardStatus("done")).toBe(true);
  expect(isBoardStatus("error_damaged")).toBe(false);
  expect(isBoardStatus(1)).toBe(false);
});

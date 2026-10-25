import {
  BOARD_STATUSES,
  isBoardStatus,
  PIE_ORDER,
  STATUS_CONFIG,
  STATUS_SELECT_ORDER,
  statusLabels,
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

test("一般の人には他候補のポスターを「要確認」とだけ出す", () => {
  expect(statusLabels("error_wrong_poster", false)).toEqual({
    label: "要確認",
    shortLabel: "要確認",
  });
  expect(statusLabels("error_wrong_poster", true)).toEqual({
    label: "エラー（他候補のポスターが貼られている）",
    shortLabel: "他候補",
  });
});

test("他候補以外の呼び方は、一般の人と参加中の人で同じ", () => {
  for (const status of BOARD_STATUSES.filter((s) => s !== "error_wrong_poster")) {
    expect(statusLabels(status, false)).toEqual(statusLabels(status, true));
  }
});

test("一般の人向けの呼び方には「他候補」が入らない", () => {
  for (const status of BOARD_STATUSES) {
    const { label, shortLabel } = statusLabels(status, false);
    expect(`${label}${shortLabel}`).not.toContain("他候補");
  }
});

test("isBoardStatus は定義済みの値だけを通す", () => {
  expect(isBoardStatus("done")).toBe(true);
  expect(isBoardStatus("error_damaged")).toBe(false);
  expect(isBoardStatus(1)).toBe(false);
});

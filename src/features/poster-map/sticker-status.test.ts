import {
  canSetSticker,
  isStickerStatus,
  isStickerTarget,
  STICKER_SELECT_ORDER,
  STICKER_STATUSES,
} from "./sticker-status";

test("予約・完了はポスターが完了の掲示場だけ", () => {
  expect(canSetSticker("reserved", "done")).toBe(true);
  expect(canSetSticker("done", "done")).toBe(true);
  expect(canSetSticker("reserved", "not_yet")).toBe(false);
  expect(canSetSticker("done", "error_wrong_poster")).toBe(false);
});

test("未・問題ありはいつでも", () => {
  expect(canSetSticker("not_yet", "not_yet")).toBe(true);
  expect(canSetSticker("issue", "other")).toBe(true);
});

test("対象はポスターが完了の掲示場", () => {
  expect(isStickerTarget("done")).toBe(true);
  expect(isStickerTarget("reserved")).toBe(false);
});

test("選択肢はすべての状態を 1 回ずつ含む", () => {
  expect([...STICKER_SELECT_ORDER].sort()).toEqual([...STICKER_STATUSES].sort());
});

test("isStickerStatus", () => {
  expect(isStickerStatus("issue")).toBe(true);
  expect(isStickerStatus("error_wrong_poster")).toBe(false);
  expect(isStickerStatus(undefined)).toBe(false);
});

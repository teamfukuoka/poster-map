import {
  INVITE_CODE_MAX_LENGTH,
  INVITE_CODE_MIN_LENGTH,
  LABEL_MAX_LENGTH,
  normalizeInviteCode,
  RESET_CONFIRM_WORD,
  validateInviteCode,
  validateLabel,
} from "./validation";

test("定数", () => {
  expect(INVITE_CODE_MIN_LENGTH).toBe(8);
  expect(INVITE_CODE_MAX_LENGTH).toBe(64);
  expect(LABEL_MAX_LENGTH).toBe(50);
  expect(RESET_CONFIRM_WORD).toBe("リセット");
});

describe("normalizeInviteCode", () => {
  test("前後の空白を落とす", () => {
    expect(normalizeInviteCode("  abc\n")).toBe("abc");
  });

  test("全角を半角に揃える", () => {
    expect(normalizeInviteCode("ｔｅｓｔ－２３４５")).toBe("test-2345");
  });
});

describe("validateInviteCode", () => {
  test.each(["test-2345", "Test-2345", `a1-${"x".repeat(61)}`])("%s は通る", (code) => {
    expect(validateInviteCode(code)).toBeNull();
  });

  test.each([
    ["7文字", "ab-1234"],
    ["記号なし", "abcdefgh2345"],
    ["数字なし", "abcd-efgh"],
    ["英字なし", "1234-5678"],
    ["空白入り", "abcd 12-34"],
    ["65文字", `a1-${"x".repeat(62)}`],
    ["全角入り", "abcd-12あ"],
    ["空", ""],
  ])("%s は文言を返す", (_name, code) => {
    expect(validateInviteCode(code)).toBe(
      "参加コードは8〜64文字で、英字・数字・記号をそれぞれ1つ以上入れてください。空白は使えません。",
    );
  });
});

describe("validateLabel", () => {
  test.each(["", "あ".repeat(51)])("%j は文言を返す", (label) => {
    expect(validateLabel(label)).toBe("配布先の名前は1〜50文字で入れてください。");
  });

  test("1文字・50文字は通る", () => {
    expect(validateLabel("あ")).toBeNull();
    expect(validateLabel("あ".repeat(50))).toBeNull();
  });
});

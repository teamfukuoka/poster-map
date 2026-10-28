import {
  INVITE_CODE_MAX_LENGTH,
  INVITE_CODE_MIN_LENGTH,
  LABEL_MAX_LENGTH,
  MEMBER_EMAIL_MAX_LENGTH,
  normalizeInviteCode,
  normalizeMemberEmail,
  RESET_CONFIRM_WORD,
  validateInviteCode,
  validateLabel,
  validateMemberEmail,
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

describe("normalizeMemberEmail", () => {
  test("全角を半角に・前後の空白を落とし・小文字にそろえる", () => {
    expect(normalizeMemberEmail("　ＮＥＷ-Member@Example.invalid \n")).toBe(
      "new-member@example.invalid",
    );
  });
});

describe("validateMemberEmail", () => {
  test.each([
    "a@example.invalid",
    "first.last+tag@sub.example.invalid",
    `${"a".repeat(MEMBER_EMAIL_MAX_LENGTH - 16)}@example.invalid`,
  ])("%s は通る", (email) => {
    expect(validateMemberEmail(email)).toBeNull();
  });

  test.each([
    "",
    "no-at-mark.example.invalid",
    "two@@example.invalid",
    "no-dot@example",
    "space in@example.invalid",
    "日本語@example.invalid",
    `${"a".repeat(MEMBER_EMAIL_MAX_LENGTH - 15)}@example.invalid`,
  ])("%p は通らない", (email) => {
    expect(validateMemberEmail(email)).toBe(
      "メールアドレスの形になっていません。入れ直してください。",
    );
  });
});

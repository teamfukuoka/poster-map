import { normalizeInviteCode } from "./invite-code";

describe("normalizeInviteCode", () => {
  test("前後の空白・改行を落とす", () => {
    expect(normalizeInviteCode("  abc\n")).toBe("abc");
  });

  test("全角の空白・タブも落とす", () => {
    expect(normalizeInviteCode("　abc\t")).toBe("abc");
  });

  test("全角の英数字・記号を半角に揃える", () => {
    expect(normalizeInviteCode("ｔｅｓｔ－２３４５")).toBe("test-2345");
    expect(normalizeInviteCode("Ａｂ！＃１２")).toBe("Ab!#12");
  });

  test("大文字小文字は変えない", () => {
    expect(normalizeInviteCode("Test-2345")).toBe("Test-2345");
  });
});

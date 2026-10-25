import { normalizeInviteCode, normalizeJoinCode } from "./invite-code";

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

describe("normalizeJoinCode", () => {
  test.each([
    ["abc\u2013123", "en dash"],
    ["abc\u30fc123", "長音"],
    ["abc\u2212123", "マイナス記号"],
    ["abc\u2010123", "ハイフン"],
    ["abc\u2011123", "改行しないハイフン"],
    ["abc\u2012123", "figure dash"],
    ["abc\u2014123", "em dash"],
    ["abc\u2015123", "horizontal bar"],
    ["abc\uff70123", "半角の長音"],
    [" \uff41\uff42\uff43\u30fc\uff11\uff12\uff13 ", "全角の英数字と長音"],
  ])("%s（%s）を ASCII のハイフンに寄せる", (input) => {
    expect(normalizeJoinCode(input)).toBe("abc-123");
  });

  test("ASCII のコードはそのまま", () => {
    expect(normalizeJoinCode("Test-2345")).toBe("Test-2345");
  });

  test("登録側の normalizeInviteCode は長音を変えない", () => {
    expect(normalizeInviteCode("abc\u30fc123")).toBe("abc\u30fc123");
  });
});
